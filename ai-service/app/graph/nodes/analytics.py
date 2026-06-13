import json
import time
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from app.config import settings
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import get_campaign_communications_stats
from app.tools.vector_tools import store_analytics_narrative
from app.utils.callbacks import post_progress

ANALYTICS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a marketing analytics expert for Zari fashion brand.
    Analyze campaign performance metrics and generate actionable insights.
    Be specific — mention variant winners, optimal send times, audience recommendations.
    Format as 2-3 bullet points, then a 1-line recommendation.
    """),
    ("human", """Campaign: {campaign_name}
Goal: {goal}
Channel: {channel}
Audience size: {segment_size}

Metrics:
{metrics_json}

Generate insights and recommendations."""),
])


def analytics_node(state: CRMAgentState) -> dict:
    campaign_draft = state.get("campaign_draft", {})
    campaign_id = campaign_draft.get("campaign_id")
    plan = state.get("campaign_plan", {})

    post_progress(state["session_id"], "analytics", "Computing campaign analytics...", step="analyze")

    # Brief wait so fastest callbacks arrive before we read metrics
    time.sleep(2)

    if not campaign_id:
        post_progress(state["session_id"], "analytics", "No campaign ID — skipping analytics", step="analyze")
        return {"analytics_report": None, "current_step": "optimize"}

    # fetch metrics from MongoDB
    metrics_raw = get_campaign_communications_stats.invoke(campaign_id)
    try:
        metrics = json.loads(metrics_raw)
    except Exception:
        metrics = {}

    # Skip LLM if no data yet — messages still delivering
    if metrics.get("sent", 0) == 0:
        post_progress(state["session_id"], "analytics", "No delivery data yet — campaign running", step="analyze")
        return {
            "analytics_report": {
                "campaign_id": campaign_id,
                "funnel": metrics,
                "insights_text": "Campaign dispatched — analytics update as messages are delivered.",
                "recommendations": [],
            },
            "current_step": "optimize",
        }

    # generate insights via LLM
    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.3,
    )

    chain = ANALYTICS_PROMPT | llm

    result = chain.invoke({
        "campaign_name": plan.get("campaign_name", "Campaign"),
        "goal": plan.get("goal", "re-engage"),
        "channel": plan.get("channel_preference", "whatsapp"),
        "segment_size": state.get("segment", {}).get("size", 0),
        "metrics_json": json.dumps(metrics, indent=2),
    })

    insights_text = result.content

    # store narrative in Qdrant for future RAG
    narrative = (
        f"{plan.get('campaign_name', 'Campaign')}: {plan.get('goal', '')} via {plan.get('channel_preference', '')}. "
        f"Audience: {state.get('segment', {}).get('description', '')}. "
        f"Results: {metrics.get('open_rate', 0)}% open rate, {metrics.get('conversion_rate', 0)}% conversion. "
        f"Insights: {insights_text}"
    )

    store_analytics_narrative.invoke({
        "narrative": narrative,
        "metadata_json": json.dumps({
            "campaign_id": campaign_id,
            "goal": plan.get("goal"),
            "channel": plan.get("channel_preference"),
            "open_rate": metrics.get("open_rate", 0),
            "conversion_rate": metrics.get("conversion_rate", 0),
        }),
    })

    report = {
        "campaign_id": campaign_id,
        "funnel": metrics,
        "insights_text": insights_text,
        "recommendations": [],
    }

    post_progress(
        state["session_id"],
        "analytics",
        f"Analytics ready — {metrics.get('open_rate', 0)}% open rate, {metrics.get('conversion_rate', 0)}% conversion",
        step="analyze",
        data={"metrics": metrics},
    )

    return {
        "analytics_report": report,
        "current_step": "optimize",
    }
