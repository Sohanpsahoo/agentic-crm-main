import json
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List
from pymongo import MongoClient
from app.config import settings
from app.tools.mongo_tools import save_segment
from app.tools.vector_tools import search_segment_profiles
from app.utils.callbacks import post_progress
from app.graph.state import CRMAgentState

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri)
    return _client["crm"]


class SegmentPipeline(BaseModel):
    stages: List[dict] = Field(description="MongoDB aggregation pipeline stages as dicts")
    segment_name: str = Field(description="Short descriptive name for this segment")
    segment_description: str = Field(description="One sentence describing who is in this segment")


PIPELINE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a data analyst for Zari fashion brand.
Generate a MongoDB aggregation pipeline for the customers collection.

Customer schema:
- name, email, phone
- channel_preferences: {{whatsapp, sms, email, rcs}} (booleans)
- tags: ["vip","churned","at-risk","active","loyal","champion","one-time","high-value"]
- ltv: number (lifetime value INR)
- last_purchase_at: ISODate
- total_orders: number
- avg_order_value: number
- top_categories: array of strings
- demographics: {{age_group: "18-24" | "25-34" | "35-44" | "45-54" | "55+", gender}}
- location: {{city, country}}

Rules:
1. The `stages` field MUST be a single JSON list of aggregation stage objects. All stages (such as `$match` and `$limit`) MUST be elements inside this list.
2. For multiple filter criteria, combine them into a single `$match` stage.
3. For "purchased in the last N months/days" (recent buyers): use `$expr: {{"$gte": ["$last_purchase_at", {{"$subtract": ["$$NOW", N_milliseconds]}}]}}`
   - Example (last 2 months/60 days): `$expr: {{"$gte": ["$last_purchase_at", {{"$subtract": ["$$NOW", 5184000000]}}]}}`
4. For "haven't purchased in N months/days" (churned): use `$expr: {{"$lt": ["$last_purchase_at", {{"$subtract": ["$$NOW", N_milliseconds]}}]}}`
5. Always convert months to milliseconds! (1 month ≈ 30 days = 2592000000 ms, 2 months = 5184000000 ms, 3 months = 7776000000 ms, 6 months = 15552000000 ms).
6. Channel filter format: {{"channel_preferences.<channel>": true}}.
7. Always end the `stages` list with a limit stage: {{"$limit": 500}}.
8. Return full customer documents, not just IDs.
9. BE STRICT: If the user asks for a date range, you MUST include the `$expr` match condition! DO NOT JUST MATCH EVERYTHING.

Past segment examples for reference:
{rag_context}
"""),
    ("human", "Criteria: {criteria}\nChannel preference: {channel}\n\nGenerate the pipeline stages. Give a very descriptive segment_description detailing the parameters used (e.g., 'Customers who purchased within the last 60 days.')."),
])


def segmentation_node(state: CRMAgentState) -> dict:
    post_progress(state["session_id"], "segmentation", "Searching for matching customers...", step="segment")

    plan = state["campaign_plan"]
    criteria = plan.get("segment_criteria", {})
    channel = plan.get("channel_preference", "any")

    # RAG: retrieve similar past segment definitions
    rag_raw = search_segment_profiles.invoke(f"{json.dumps(criteria)} channel:{channel}")
    rag_context = rag_raw if isinstance(rag_raw, str) else json.dumps(rag_raw)

    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.0,
    )

    chain = PIPELINE_PROMPT | llm.with_structured_output(SegmentPipeline)

    try:
        plan_result = chain.invoke({
            "criteria": json.dumps(criteria),
            "channel": channel,
            "rag_context": rag_context,
        })
        pipeline_stages = plan_result.stages
        seg_name = plan_result.segment_name
        seg_desc = plan_result.segment_description
    except Exception as e:
        post_progress(state["session_id"], "segmentation", f"Pipeline generation failed: {e}", step="segment")
        return {"segment": {"customer_ids": [], "size": 0, "error": str(e)}, "current_step": "create_campaign"}

    # Execute pipeline directly
    try:
        db = get_db()
        customers = list(db.customers.aggregate(pipeline_stages))
        customer_ids = [str(c["_id"]) for c in customers]
    except Exception as e:
        post_progress(state["session_id"], "segmentation", f"Pipeline execution failed: {e}", step="segment")
        customer_ids = []
        seg_name = seg_name if "seg_name" in dir() else "Fallback Segment"
        seg_desc = seg_desc if "seg_desc" in dir() else ""

    size = len(customer_ids)

    # Save segment to MongoDB
    segment_id = None
    if customer_ids:
        try:
            saved = json.loads(save_segment.invoke(json.dumps({
                "name": seg_name,
                "description": seg_desc,
                "criteria_nl": plan.get("intent", ""),
                "criteria_json": pipeline_stages,
                "customer_ids": customer_ids,
                "size": size,
            })))
            segment_id = saved.get("segment_id")
        except Exception:
            pass

    segment_data = {
        "segment_id": segment_id,
        "name": seg_name,
        "description": seg_desc,
        "customer_ids": customer_ids,
        "size": size,
    }

    post_progress(
        state["session_id"],
        "segmentation",
        f"Segment '{seg_name}': {size} customers matched",
        step="segment",
        data={"size": size, "segment_id": segment_id},
    )

    return {
        "segment": segment_data,
        "current_step": "create_campaign",
    }
