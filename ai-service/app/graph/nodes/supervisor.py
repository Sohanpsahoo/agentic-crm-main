import json
from langchain_groq import ChatGroq
from app.config import settings
from app.models.campaign import CampaignPlan
from app.prompts.supervisor_prompt import SUPERVISOR_PROMPT
from app.graph.state import CRMAgentState
from app.utils.callbacks import post_progress


def supervisor_node(state: CRMAgentState) -> dict:
    post_progress(state["session_id"], "supervisor", "Analyzing your request...", step="supervisor")

    # Inject live CRM aggregate stats
    from app.tools.mongo_tools import get_db
    try:
        db = get_db()
        total_customers = db.customers.count_documents({})
        active_campaigns = db.campaigns.count_documents({"status": "running"})
        live_context = {
            "total_customers": total_customers,
            "active_campaigns": active_campaigns,
        }
    except Exception:
        live_context = {}

    merged_context = {**state.get("context", {}), **live_context}

    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.1,
    )

    chain = SUPERVISOR_PROMPT | llm.with_structured_output(CampaignPlan)

    plan: CampaignPlan = chain.invoke({
        "query": state["raw_query"],
        "context": json.dumps(merged_context),
    })

    post_progress(
        state["session_id"],
        "supervisor",
        f"Plan created: {len(plan.steps)} steps — {', '.join(plan.steps)}",
        step="supervisor",
        data={"plan": plan.model_dump()},
    )

    return {
        "campaign_plan": plan.model_dump(),
        "current_step": plan.steps[0] if plan.steps else "done",
    }
