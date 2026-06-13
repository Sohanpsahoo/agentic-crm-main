import json
from langchain_groq import ChatGroq
from app.config import settings
from app.models.campaign import CampaignCopy
from app.prompts.campaign_creation_prompt import CAMPAIGN_CREATION_PROMPT
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import save_campaign
from app.tools.vector_tools import search_past_campaigns, search_brand_voice
from app.tools.offer_tools import get_active_offers
from app.utils.callbacks import post_progress

_GOAL_TAG = {
    "re-engage": "churned",
    "winback": "churned",
    "loyalty": "vip",
    "upsell": "vip",
    "welcome": "new",
    "announce": "",
}


def _pick_offer_text(goal: str, channel: str) -> str:
    tag = _GOAL_TAG.get(goal.lower(), "")
    ch_str = channel or ""
    raw = get_active_offers.invoke({"tags": tag, "channel": ch_str})
    try:
        offers = json.loads(raw)
        if not isinstance(offers, list) or not offers:
            return "an exclusive offer"
        o = offers[0]
        if o["type"] == "percentage":
            return f"{int(o['value'])}% OFF your next purchase"
        if o["type"] == "fixed":
            return f"₹{int(o['value'])} off your next order"
        if o["type"] == "points_multiplier":
            return f"{int(o['value'])}x loyalty points"
        return o.get("description", "an exclusive offer")
    except Exception:
        return "an exclusive discount just for you"


def campaign_creation_node(state: CRMAgentState) -> dict:
    post_progress(state["session_id"], "campaign_creation", "Generating campaign copy...", step="create_campaign")

    plan = state["campaign_plan"]
    segment = state.get("segment", {})

    goal = plan.get("goal", "re-engage")
    channel = plan.get("channel_preference", "whatsapp")
    segment_name = segment.get("name", "selected customers")
    segment_size = segment.get("size", 0)

    # RAG: retrieve past campaigns with similar goal + channel
    rag_query = f"{goal} campaign {channel} fashion brand India"
    rag_raw = search_past_campaigns.invoke(rag_query)
    try:
        rag_docs = json.loads(rag_raw) if isinstance(rag_raw, str) else rag_raw
        rag_context = "\n---\n".join([d.get("content", "") for d in rag_docs[:3]])
    except Exception:
        rag_context = ""

    # RAG: brand voice
    brand_voice = search_brand_voice.invoke(f"{channel} {goal} copy")

    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.7,
    )

    chain = CAMPAIGN_CREATION_PROMPT | llm.with_structured_output(CampaignCopy)

    # Fetch real offer from DB instead of hardcoded text
    offer_text = _pick_offer_text(goal, channel)

    copy: CampaignCopy = chain.invoke({
        "goal": goal,
        "channel": channel,
        "segment_description": segment.get("description", segment_name),
        "segment_size": segment_size,
        "offer": offer_text,
        "rag_context": rag_context,
        "brand_voice": brand_voice if isinstance(brand_voice, str) else "",
    })

    # save to MongoDB
    campaign_data = {
        "name": plan.get("campaign_name", f"Campaign - {goal} via {channel}"),
        "goal": goal,
        "channel": channel,
        "segment_id": segment.get("segment_id"),
        "copy_variants": [v.model_dump() for v in copy.variants],
        "agent_session_id": state["session_id"],
        "metrics_summary": {"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "converted": 0},
    }

    save_result = save_campaign.invoke(json.dumps(campaign_data))
    try:
        campaign_id = json.loads(save_result).get("campaign_id")
    except Exception:
        campaign_id = None

    campaign_draft = {
        **copy.model_dump(),
        "campaign_id": campaign_id,
        "goal": goal,
        "channel": channel,
    }

    post_progress(
        state["session_id"],
        "campaign_creation",
        f"Campaign '{campaign_data['name']}' created with 2 A/B variants",
        step="create_campaign",
        data={"campaign_id": campaign_id},
    )

    return {
        "campaign_draft": campaign_draft,
        "current_step": "personalize",
    }
