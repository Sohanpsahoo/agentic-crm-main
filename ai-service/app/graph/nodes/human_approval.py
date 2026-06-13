import httpx
from app.graph.state import CRMAgentState
from app.utils.callbacks import post_progress
from app.config import settings


def human_approval_node(state: CRMAgentState) -> dict:
    """This node is interrupted by LangGraph before execution.
    When the graph is resumed (via /run/:session_id/resume), marketer_approval is set.
    """
    messages = state.get("personalized_messages", [])
    segment = state.get("segment", {})

    predicted_metrics = state.get("context", {}).get("predicted_metrics", {})
    plan = state.get("campaign_plan", {})
    
    # notify frontend that approval is required
    post_progress(
        state["session_id"],
        "human_approval",
        f"Approval required: campaign will reach {len(messages)} customers in segment '{segment.get('name', 'unknown')}'",
        step="await_approval",
        data={
            "requires_approval": True,
            "audience_size": len(messages),
            "segment_name": segment.get("name"),
            "segment_reason": plan.get("intent", ""),
            "predicted_metrics": predicted_metrics,
            "channel": plan.get("channel_preference", "auto"),
            "message_preview": messages[0].get("message") if messages else ""
        },
    )

    # this node does nothing itself — LangGraph interrupt_before handles the pause
    # when resumed, marketer_approval will be in state
    approved = state.get("marketer_approval", False)

    if not approved:
        return {"errors": ["Campaign cancelled by marketer"], "final_summary": "Campaign cancelled."}

    return {"current_step": "execute"}
