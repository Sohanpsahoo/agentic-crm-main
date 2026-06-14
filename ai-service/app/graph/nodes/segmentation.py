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
- demographics: {{age_group: "<18" | "18-24" | "25-34" | "35-44" | "45-54" | "55+", gender}}
- location: {{city, country}}

Rules:
1. The `stages` field MUST be a single JSON list of aggregation stage objects. 
2. CRITICAL: A pipeline stage specification object must contain exactly one field. For example, do NOT combine {{"$match": {{...}}, "$limit": 500}} into one object. They MUST be separate objects in the array: [{{"$match": {{...}}}}, {{"$limit": 500}}].
3. For multiple filter criteria, combine them into a single `$match` stage.
4. For date filters, the current date is {current_date}. 
5. For "purchased in the last N months/days", use `$gte` with a calculated ISO string. For example: {{"$match": {{"last_purchase_at": {{"$gte": "2024-04-13T00:00:00Z"}}}}}}
6. For "haven't purchased in N months/days" (churned), use `$lt` with a calculated ISO string. For example: {{"$match": {{"last_purchase_at": {{"$lt": "2024-04-13T00:00:00Z"}}}}}}
7. For "didn't purchase in [Year]" (e.g. 2026), ensure last_purchase_at is strictly before the start of that Year: {{"$match": {{"last_purchase_at": {{"$lt": "2026-01-01T00:00:00Z"}}}}}}
8. Channel filter format: {{"$match": {{"channel_preferences.<channel>": true}}}}. Do not forget the $match!
9. Always end the `stages` list with a separate limit stage: {{"$limit": 500}}.
10. Return full customer documents, not just IDs.
11. BE STRICT: DO NOT use `$expr` or `$$NOW` as it is not supported in this Atlas cluster. Use standard `$gte` and `$lt` matching.

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
            "current_date": __import__('datetime').datetime.utcnow().isoformat() + "Z",
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
