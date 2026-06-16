import threading
import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.graph.graph import compiled_graph
from app.graph.state import CRMAgentState
from app.graph.monitor_graph import compiled_monitor
from app.rag.ingestion import ingest_document, ingest_documents
from app.utils.callbacks import post_progress
from app.config import settings

app = FastAPI(title="CRM AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (replace with Redis/MongoDB for production)
sessions: dict[str, dict] = {}


class RunRequest(BaseModel):
    session_id: str
    query: str
    context: dict = {}
    ws_callback: Optional[str] = None


class ResumeRequest(BaseModel):
    approved: bool


class IngestRequest(BaseModel):
    collection: str
    text: str
    metadata: dict = {}


def run_graph_background(session_id: str, query: str, context: dict):
    """Run LangGraph in a background thread so FastAPI stays non-blocking."""
    initial_state: CRMAgentState = {
        "raw_query": query,
        "session_id": session_id,
        "context": context,
        "campaign_plan": None,
        "segment": None,
        "campaign_draft": None,
        "personalized_messages": [],
        "channel_assignments": None,
        "execution_records": [],
        "analytics_report": None,
        "optimization_plan": None,
        "errors": [],
        "current_step": "supervisor",
        "requires_approval": False,
        "marketer_approval": None,
        "final_summary": None,
    }

    try:
        config = {"configurable": {"thread_id": session_id}}
        # stream events — collect final state
        final_state = None
        for event in compiled_graph.stream(initial_state, config=config):
            final_state = event

        sessions[session_id] = {"status": "completed", "state": final_state}

        # notify backend
        with httpx.Client(timeout=10.0) as client:
            client.post(
                f"{settings.backend_url}/api/agent/completed",
                json={
                    "session_id": session_id,
                    "result": {
                        "summary": (final_state or {}).get("final_summary", "Campaign complete"),
                        "analytics": (final_state or {}).get("analytics_report"),
                        "optimization": (final_state or {}).get("optimization_plan"),
                    },
                },
            )
    except Exception as e:
        sessions[session_id] = {"status": "error", "error": str(e)}
        post_progress(session_id, "system", f"Error: {str(e)}", step="error")


@app.post("/run", status_code=202)
async def run_agent(req: RunRequest, background_tasks: BackgroundTasks):
    sessions[req.session_id] = {"status": "running"}
    background_tasks.add_task(
        run_graph_background,
        req.session_id,
        req.query,
        req.context,
    )
    return {"session_id": req.session_id, "status": "started"}


@app.get("/run/{session_id}/status")
async def get_status(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.post("/run/{session_id}/resume")
async def resume_graph(session_id: str, req: ResumeRequest, background_tasks: BackgroundTasks):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # update state with approval and resume
    config = {"configurable": {"thread_id": session_id}}
    compiled_graph.update_state(config, {"marketer_approval": req.approved})

    # resume in background
    def resume_background():
        try:
            final_state = None
            for event in compiled_graph.stream(None, config=config):
                final_state = event
            sessions[session_id] = {"status": "completed", "state": final_state}
            with httpx.Client(timeout=10.0) as client:
                client.post(
                    f"{settings.backend_url}/api/agent/completed",
                    json={"session_id": session_id, "result": {"summary": "Campaign resumed and completed"}},
                )
        except Exception as e:
            sessions[session_id] = {"status": "error", "error": str(e)}

    background_tasks.add_task(resume_background)
    return {"status": "resumed"}


@app.post("/rag/ingest")
async def rag_ingest(req: IngestRequest):
    ingest_document(req.collection, req.text, req.metadata)
    return {"status": "ingested", "collection": req.collection}


_last_monitor_results: dict = {}


def run_monitor_background():
    global _last_monitor_results
    try:
        result = compiled_monitor.invoke({"alerts": [], "monitor_ran_at": ""})
        _last_monitor_results = result
        alerts = result.get("alerts", [])
        if alerts:
            with httpx.Client(timeout=10.0) as client:
                client.post(
                    f"{settings.backend_url}/api/monitor/webhook",
                    json={"alerts": alerts, "ran_at": result.get("monitor_ran_at", "")},
                )
    except Exception as e:
        _last_monitor_results = {"error": str(e), "alerts": []}


@app.post("/monitor/run", status_code=202)
async def run_monitor(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_monitor_background)
    return {"status": "started", "message": "Monitor running in background"}


@app.get("/monitor/results")
async def get_monitor_results():
    return _last_monitor_results


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.gemini_model}

from langchain_groq import ChatGroq

class DecisionRequest(BaseModel):
    customer: dict
    moment: str
    metadata: dict = {}
    goals: dict = {}
    guardrails: dict = {}

@app.post("/agent/decision")
async def make_decision(req: DecisionRequest):
    """
    Decide in real time whether to engage a customer based on their moment event,
    determining the channel, incentive, copy/message, and rationale using Gemini.
    """
    try:
        from app.llm_factory import get_llm
        llm = get_llm(temperature=0.1)
        
        system_prompt = (
            "You are an AI Real-Time Marketer Agent running inside AETHER_VOID storefront.\n"
            "Your task is to analyze a customer event moment (like cart_abandoned or product_viewed), "
            "along with customer details, company campaign goals, and safety guardrails, "
            "and determine the single best marketing action to take in real-time.\n\n"
            "You MUST return a JSON object with the exact following schema:\n"
            "{\n"
            "  \"engage\": boolean,\n"
            "  \"channel\": \"whatsapp\" | \"email\" | \"sms\",\n"
            "  \"incentive\": \"discount_10\" | \"discount_15\" | \"free_gift\" | \"none\",\n"
            "  \"message\": \"the fully copy/message to send, written directly to the customer in a cool, dark-mode, neon cyberpunk tone, including details of their items\",\n"
            "  \"rationale\": \"short reasoning for your decision\"\n"
            "}\n\n"
            "Do NOT include any markdown code blocks (like ```json) or explanation. Return raw JSON."
        )
        
        user_prompt = (
            f"CUSTOMER DETAILS:\n"
            f"- Name: {req.customer.get('name')}\n"
            f"- Phone: {req.customer.get('phone')}\n"
            f"- Lifetime Value (LTV): Rs. {req.customer.get('ltv')}\n"
            f"- Total Orders: {req.customer.get('total_orders')}\n\n"
            f"MOMENT EVENT: {req.moment}\n"
            f"EVENT METADATA: {req.metadata}\n\n"
            f"GOALS: {req.goals}\n"
            f"GUARDRAILS: {req.guardrails}\n\n"
            f"Evaluate whether it is high-leverage to engage. If cart value is high, consider offering a discount incentive (within guardrails). Write a highly personalized, compelling message. Output JSON."
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = llm.invoke(messages)
        content = response.content.strip()
        
        if content.startswith("```json"):
            content = content.split("```json")[1].split("```")[0].strip()
        elif content.startswith("```"):
            content = content.split("```")[1].split("```")[0].strip()
            
        import json
        decision_data = json.loads(content)
        return decision_data
        
    except Exception as e:
        print(f"Error in decision: {str(e)}")
        return {
            "engage": True,
            "channel": "whatsapp",
            "incentive": "none",
            "message": f"Hey {req.customer.get('name', 'there')}, we saw you looking at our items! Don't miss out on AETHER_VOID drops.",
            "rationale": f"Fallback due to error: {str(e)}"
        }


class ChatRequest(BaseModel):
    message: str
    history: Optional[list] = []
    customer_name: Optional[str] = "Customer"

class SegmentRequest(BaseModel):
    query: str

class SegmentPersonaRequest(BaseModel):
    segment_id: str
    sample_customers: list

@app.post("/agent/segment-persona")
async def generate_segment_persona(req: SegmentPersonaRequest):
    """Generate a detailed persona card for a segment based on customer data."""
    try:
        from app.llm_factory import get_llm
        llm = get_llm(temperature=0.4)
        
        system_prompt = (
            "You are an expert marketing strategist and persona researcher.\n"
            "Analyze the given list of sample customers from a specific segment.\n"
            "Synthesize them into a single, cohesive, highly-detailed 'Buyer Persona Card' that represents this segment.\n\n"
            "Return EXACTLY a JSON object with this schema:\n"
            "{\n"
            "  \"persona_name\": \"e.g. Trendy Urbanite\",\n"
            "  \"demographics\": \"e.g. 25-35, Metro areas\",\n"
            "  \"traits\": [\"fashion-forward\", \"price-insensitive\", \"impulsive\"],\n"
            "  \"motivations\": \"What drives them to buy?\",\n"
            "  \"pain_points\": \"What holds them back?\",\n"
            "  \"ideal_messaging\": \"How should we talk to them?\"\n"
            "}\n\n"
            "Do NOT include markdown like ```json. Return raw JSON."
        )
        
        user_prompt = f"SAMPLE CUSTOMERS DATA:\n{req.sample_customers}\n\nGenerate the persona card JSON."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = llm.invoke(messages)
        content = response.content.strip()
        
        if content.startswith("```json"):
            content = content.split("```json")[1].split("```")[0].strip()
        elif content.startswith("```"):
            content = content.split("```")[1].split("```")[0].strip()
            
        import json
        return json.loads(content)
        
    except Exception as e:
        print(f"Error in segment persona: {str(e)}")
        return {
            "persona_name": "Generic Shopper",
            "demographics": "Varied",
            "traits": ["engaged"],
            "motivations": "Value and quality",
            "pain_points": "High friction checkout",
            "ideal_messaging": "Clear and concise."
        }

@app.post("/agent/segment")
async def generate_segment_from_nl(req: SegmentRequest):
    """Generate a customer segment from natural language."""
    from app.graph.nodes.segmentation import PIPELINE_PROMPT, SegmentPipeline, get_db
    from app.llm_factory import get_llm
    from app.tools.mongo_tools import save_segment
    import json
    
    llm = get_llm(temperature=0.0)
    
    chain = PIPELINE_PROMPT | llm.with_structured_output(SegmentPipeline)
    
    try:
        plan_result = chain.invoke({
            "criteria": req.query,
            "channel": "any",
            "rag_context": "",
            "current_date": __import__('datetime').datetime.utcnow().isoformat() + "Z",
        })
        pipeline_stages = plan_result.stages
        seg_name = plan_result.segment_name
        seg_desc = plan_result.segment_description
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline generation failed: {str(e)}")
        
    try:
        db = get_db()
        
        def convert_dates(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if isinstance(v, str) and len(v) >= 19 and "T" in v and "-" in v and ":" in v:
                        try:
                            from dateutil import parser
                            obj[k] = parser.isoparse(v)
                        except Exception:
                            pass
                    else:
                        convert_dates(v)
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    if isinstance(v, str) and len(v) >= 19 and "T" in v and "-" in v and ":" in v:
                        try:
                            from dateutil import parser
                            obj[i] = parser.isoparse(v)
                        except Exception:
                            pass
                    else:
                        convert_dates(v)
        
        convert_dates(pipeline_stages)
        customers = list(db.customers.aggregate(pipeline_stages))
        customer_ids = [str(c["_id"]) for c in customers]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")
        
    size = len(customer_ids)
    
    segment_id = None
    try:
        saved = json.loads(save_segment.invoke(json.dumps({
            "name": seg_name,
            "description": seg_desc,
            "criteria_nl": req.query,
            "criteria_json": pipeline_stages,
            "customer_ids": customer_ids,
            "size": size,
        }, default=str)))
        segment_id = saved.get("segment_id")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save segment: {str(e)}")
            
    return {
        "segment_id": segment_id,
        "name": seg_name,
        "description": seg_desc,
        "size": size,
        "pipeline": pipeline_stages
    }

_CRM_TOOL_SELECT_PROMPT = """You are ZariBot, the AI CRM controller for Zari Fashion. You have tools to control the entire CRM.
Based on the user's query, select the single most appropriate tool to run using the provided native tool calling feature. Do not try to explain or write a conversational response yet.

TOOL SELECTION RULES — apply in order:
1. User says msg/message/send/blast/text/notify/whatsapp/sms/tell/contact/reach/email to ANY group → call simulate_message_to_devices RIGHT NOW, no questions
2. If the user asks a question about customer statistics, lists of customers matching criteria, or who has or hasn't ordered in N days, and it can be answered directly using the customer database context provided, DO NOT call any tool. Just reply directly with the names/phones/details of the customers.
3. show/list/find/get customers/people → list_customers (use criteria parameter for natural language filters like age, e.g. criteria="under 18")
4. analytics/stats/performance/open rate/conversion → get_analytics_overview
5. campaigns → list_campaigns
6. segments → list_segments  
7. offers/discounts/promo → list_offers
8. launch/run/create campaign → launch_new_campaign
9. pause/stop/complete/update campaign → update_campaign_status

Never ask clarifying questions. Just call the correct tool."""

_CRM_RESPONSE_FORMAT_PROMPT = """You are ZariBot, the AI CRM controller for Zari Fashion.
You have just successfully executed the requested CRM action. 

Based on the tool outputs, write a friendly, conversational, human-like response summarizing the action you took. Avoid rigid, robotic templates or placeholders. Talk like a real manager or assistant: e.g., mention how many messages were successfully dispatched, share a sample preview naturally, and invite them to see them live in the Simulation Center. Keep it brief (3-5 sentences)."""


def _build_crm_tools():
    from app.tools.crm_tools import (
        simulate_message_to_devices,
        list_customers,
        list_segments,
        list_campaigns,
        get_campaign_analytics,
        update_campaign_status,
        launch_new_campaign,
        get_analytics_overview,
        get_channel_performance,
        list_offers,
        create_offer,
        update_customer,
    )
    return [
        simulate_message_to_devices,
        list_customers,
        list_segments,
        list_campaigns,
        get_campaign_analytics,
        update_campaign_status,
        launch_new_campaign,
        get_analytics_overview,
        get_channel_performance,
        list_offers,
        create_offer,
        update_customer,
    ]


def get_crm_tools():
    return _build_crm_tools()


@app.post("/agent/chat")
async def chat_with_device(req: ChatRequest):
    """
    Groq-powered 3-phase CRM agent:
    Phase 1 — tool selection (llm with tools, single call)
    Phase 2 — tool execution (direct Python, no LLM)
    Phase 3 — response formatting (plain llm, no tools, truncated context)
    """
    import json as _json
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
        from app.tools.mongo_tools import get_db
        import datetime

        # Fetch MongoDB aggregate stats to inject in LLM context (reduces TPM vs raw list)
        try:
            total_customers = db.customers.count_documents({})
            recent_customers = list(db.customers.find({}, {"name": 1, "tags": 1}).sort("created_at", -1).limit(5))
            recent_names = ", ".join([c.get("name", "") for c in recent_customers])
            
            db_context = (
                "You have access to the customer database from MongoDB to answer queries directly.\n"
                f"Total Customers: {total_customers}\n"
                f"Recent Customers: {recent_names}\n"
                "Use the provided tools to query detailed customer lists or run campaigns."
            )
        except Exception as dbe:
            db_context = f"Error fetching MongoDB customer database: {str(dbe)}"

        from langchain_groq import ChatGroq

        import os
        groq_keys = [
            settings.groq_api_key,
        ]
        if os.environ.get("GROQ_API_KEY_FALLBACK"):
            groq_keys.append(os.environ.get("GROQ_API_KEY_FALLBACK"))

        tools = get_crm_tools()
        tool_map = {t.name: t for t in tools}

        # Build messages — keep tiny to stay under 6000 TPM
        history = (req.history or [])[-5:]  # only last 5 turns
        messages = [
            SystemMessage(content=_CRM_TOOL_SELECT_PROMPT),
            SystemMessage(content=db_context)
        ]
        for h in history:
            role = h.get("role", "user")
            content = str(h.get("content", ""))[:300]
            if role in ("model", "ai", "assistant"):
                messages.append(AIMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))
        messages.append(HumanMessage(content=req.message))

        # Phase 1: single LLM call with tools always bound for dynamic capabilities
        response = None
        last_error = None
        for key in groq_keys:
            try:
                llm = ChatGroq(
                    model="llama-3.1-8b-instant",
                    groq_api_key=key,
                    temperature=0.2,
                    max_retries=0,
                    timeout=25,
                )
                llm_with_tools = llm.bind_tools(tools)
                response = llm_with_tools.invoke(messages)
                break
            except Exception as e:
                err_msg = str(e)
                if "429" in err_msg or "rate_limit" in err_msg.lower() or "organization_restricted" in err_msg.lower():
                    last_error = e
                    continue
                if "400" in err_msg:
                    # Tool validation failed (e.g. LLM hallucinated arguments). 
                    # Tell the LLM to explain the issue dynamically.
                    messages.append(SystemMessage(content="The previous tool call failed due to invalid arguments. Respond conversationally to the user explaining what went wrong and ask them to clarify their request."))
                    try:
                        response = llm.invoke(messages)
                        break
                    except Exception as fallback_e:
                        raise fallback_e
                raise e

        if not response:
            if last_error:
                raise last_error
            raise HTTPException(status_code=500, detail="Failed to invoke LLM in Phase 1")

        messages.append(response)

        if not response.tool_calls:
            reply = response.content.strip()
            return {"reply": reply or "Ready! Try: 'msg all VIP customers' or 'show churned customers'"}

        # Phase 2: execute every tool call — no LLM involved
        tool_outputs = []
        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_fn = tool_map.get(tool_name)
            if not tool_fn:
                result_str = f'{{"error":"Unknown tool {tool_name}"}}'
            else:
                try:
                    # Coerce numeric strings back to int/float where needed
                    clean_args = {}
                    for k, v in tc["args"].items():
                        if k in ("limit", "days") and not isinstance(v, int):
                            try:
                                clean_args[k] = str(int(str(v).strip() or "20"))
                            except Exception:
                                clean_args[k] = "20"
                        elif k == "value" and not isinstance(v, (int, float)):
                            try:
                                clean_args[k] = str(float(str(v)))
                            except Exception:
                                clean_args[k] = v
                        else:
                            clean_args[k] = v
                    
                    if tool_name == "simulate_message_to_devices":
                        import uuid
                        clean_args["session_id"] = str(uuid.uuid4())

                    result = tool_fn.invoke(clean_args)
                    result_str = str(result)
                except Exception as te:
                    result_str = f'{{"error":"{str(te)[:150]}"}}'

            # Truncate to avoid TPM explosion in Phase 3
            if len(result_str) > 1200:
                result_str = result_str[:1200] + "...}"

            tool_outputs.append({
                "tool": tc["name"],
                "args": tc.get("args", {}),
                "result": result_str,
                "id": tc["id"],
            })
            messages.append(ToolMessage(content=result_str, tool_call_id=tc["id"]))

        # Phase 3: generate human-readable reply with plain LLM (no tools = no loops) with failover
        reply = ""
        for key in groq_keys:
            try:
                plain_llm = ChatGroq(
                    model="llama-3.1-8b-instant",
                    groq_api_key=key,
                    temperature=0.4,
                    max_retries=0,
                    timeout=25,
                )
                summary_messages = [
                    SystemMessage(content=_CRM_RESPONSE_FORMAT_PROMPT),
                    SystemMessage(content=db_context)
                ] + messages[-(len(tool_outputs) + 2):]
                
                final = plain_llm.invoke(summary_messages)
                reply = final.content.strip()
                break
            except Exception as e:
                err_msg = str(e).lower()
                if "rate_limit" in err_msg or "429" in err_msg or "organization_restricted" in err_msg:
                    print(f"Groq RateLimit hit in Phase 3. Retrying with next key...", flush=True)
                    continue
                raise e

        # Fallback: if LLM returns nothing, build reply from raw tool output
        if not reply:
            primary = tool_outputs[0] if tool_outputs else {}
            try:
                data = _json.loads(primary.get("result", "{}"))
                if data.get("status") == "sent":
                    count = data.get("count", 0)
                    ch = data.get("channel", "whatsapp")
                    previews = data.get("preview", [])
                    lines = "\n".join(f"• **{p['name']}**: {p['message'][:70]}" for p in previews[:3])
                    reply = (
                        f"✅ Message sent to **{count} customers** via {ch}.\n\n"
                        f"{lines}\n\n"
                        f"📱 Open the **Simulation Center** tab to see messages appear live on customer phone screens!"
                    )
                elif "customers" in data:
                    custs = data.get("customers", [])[:6]
                    total = data.get("total", len(custs))
                    lines = "\n".join(
                        f"• **{c.get('name','?')}** — ₹{c.get('ltv',0):,} LTV | tags: {', '.join(c.get('tags',[]) or ['-'])}"
                        for c in custs
                    )
                    reply = f"Found **{total} customers**:\n\n{lines}"
                elif "total_customers" in data:
                    reply = (
                        f"📊 **CRM Overview**\n"
                        f"• Customers: {data.get('total_customers', 0):,}\n"
                        f"• Messages sent: {data.get('total_messages_sent', 0):,}\n"
                        f"• Open rate: {data.get('overall_open_rate', 0)}%\n"
                        f"• Conversion: {data.get('overall_conversion_rate', 0)}%"
                    )
                else:
                    reply = _json.dumps(data, indent=2)[:400]
            except Exception:
                reply = primary.get("result", "Done.")[:300]

        return {"reply": reply}

    except Exception as e:
        import traceback
        traceback.print_exc()
        err = str(e)
        if "429" in err or "rate_limit" in err.lower() or "organization_restricted" in err.lower():
            return {"reply": "⏳ API limit or Organization restriction hit — check your Groq API key. (Groq free tier: 6000 tokens/min)"}
        if "413" in err or "too large" in err.lower():
            return {"reply": "📝 Message too large for free tier. Try a shorter request."}
        return {"reply": f"⚠️ Error: {err[:200]}\n\nMake sure the AI service and backend are both running."}

class IdeateRequest(BaseModel):
    context: str

@app.post("/agent/ideate")
async def ideate(req: IdeateRequest):
    from app.tools.intelligence_tools import suggest_campaign_ideas
    return suggest_campaign_ideas(req.context)

class GenerateJourneyRequest(BaseModel):
    name: str
    description: str
    trigger: str

@app.post("/agent/generate-journey")
async def generate_journey_steps(req: GenerateJourneyRequest):
    try:
        from app.llm_factory import get_llm
        import json
        llm = get_llm(temperature=0.2)
        system_prompt = (
            "You are an expert CRM automation architect.\n"
            "Generate the optimal sequence of steps for a marketing journey.\n"
            "A step can be one of the following types:\n"
            "1. 'wait' (config: { wait_days: number })\n"
            "2. 'condition' (config: { condition: string })\n"
            "3. 'message' (config: { channel: 'whatsapp' | 'email' | 'sms' })\n"
            "4. 'offer' (config: { })\n"
            "Return EXACTLY a JSON array of step objects, where each object has 'type' and 'config'.\n"
            "Example: [{\"type\": \"wait\", \"config\": {\"wait_days\": 1}}, {\"type\": \"message\", \"config\": {\"channel\": \"email\"}}]\n"
            "Do not include any explanation or markdown formatting like ```json."
        )
        user_prompt = f"Journey Name: {req.name}\nDescription: {req.description}\nTrigger: {req.trigger}\nGenerate the steps JSON."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = llm.invoke(messages)
        content = response.content.strip()
        
        if content.startswith("```json"):
            content = content.split("```json")[1].split("```")[0].strip()
        elif content.startswith("```"):
            content = content.split("```")[1].split("```")[0].strip()
            
        steps = json.loads(content)
        # Give each step an id
        import uuid
        from app.tools.intelligence_tools import preview_message
        for step in steps:
            step["step_id"] = f"step_{uuid.uuid4().hex[:8]}"
            if step["type"] in ["message", "offer"]:
                goal = step.get("config", {}).get("campaign_goal", "engagement")
                channel = step.get("config", {}).get("channel", "email")
                step["config"]["message_content"] = preview_message(goal, channel, req.description)
            
        return {"steps": steps}
    except Exception as e:
        print(f"Error generating journey steps: {e}")
        return {"steps": []}

class SegmentPreviewRequest(BaseModel):
    query: str

@app.post("/agent/segment-preview")
async def segment_preview(req: SegmentPreviewRequest):
    from app.tools.intelligence_tools import estimate_segment_size
    return estimate_segment_size(req.query)

class MessagePreviewRequest(BaseModel):
    goal: str
    channel: str
    audience_desc: str

@app.post("/agent/message-preview")
async def message_preview(req: MessagePreviewRequest):
    from app.tools.intelligence_tools import preview_message
    return preview_message(req.goal, req.channel, req.audience_desc)

class BlastSegmentRequest(BaseModel):
    segment_id: str
    message_template: str
    channel: str
    delay_seconds: int = 0

@app.post("/agent/blast-segment")
async def blast_segment(req: BlastSegmentRequest, background_tasks: BackgroundTasks):
    import json
    import asyncio
    import httpx
    
    async def _scheduled_blast():
        if req.delay_seconds > 0:
            await asyncio.sleep(req.delay_seconds)
            
        try:
            # 1. Fetch segment customers
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(f"{settings.backend_url}/api/segments/{req.segment_id}/customers", params={"limit": 50})
                r.raise_for_status()
                data = r.json()
                customers = data.get("customers", [])
                
            if not customers:
                return
                
            # 2. Filter by channel and prepare messages
            blast_messages = []
            for c in customers:
                prefs = c.get("channel_preferences", {})
                if not prefs.get(req.channel, True):
                    continue
                    
                first_name = (c.get("name") or "there").split()[0]
                personalized = req.message_template.replace("{name}", first_name).replace("{Name}", first_name)
                
                blast_messages.append({
                    "customer_id": str(c.get("_id", "")),
                    "customer_name": c.get("name", "Customer"),
                    "channel": req.channel,
                    "message": personalized,
                    "sender": "Zari CRM",
                })
                
            # 3. Blast to Simulation Center
            if blast_messages:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.post(f"{settings.backend_url}/api/agent/blast", json={"messages": blast_messages})
        except Exception as e:
            print(f"Scheduled blast failed: {e}")

    background_tasks.add_task(_scheduled_blast)
    return {"status": "scheduled", "delay_seconds": req.delay_seconds}
