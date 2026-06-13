from langgraph.graph import StateGraph, END
from app.graph.state import CRMAgentState
from app.graph.nodes.supervisor import supervisor_node
from app.graph.nodes.segmentation import segmentation_node
from app.graph.nodes.campaign_creation import campaign_creation_node
from app.graph.nodes.personalization import personalization_node
from app.graph.nodes.channel_selection import channel_selection_node
from app.graph.nodes.execution import execution_node
from app.graph.nodes.analytics import analytics_node
from app.graph.nodes.optimization import optimization_node
from app.graph.nodes.human_approval import human_approval_node


def create_journey_node(state: CRMAgentState) -> dict:
    """Stub node for journey creation — creates a journey via backend API."""
    from app.utils.callbacks import post_progress
    import requests
    from app.config import settings

    session_id = state["session_id"]
    plan = state.get("campaign_plan", {})
    trigger = plan.get("journey_trigger", "inactivity")

    post_progress(session_id, "journey_builder", f"Creating automated journey with trigger: {trigger}", step="create_journey")

    journey_payload = {
        "name": plan.get("campaign_name", "AI-Generated Journey"),
        "description": plan.get("intent", ""),
        "trigger": {"type": trigger, "config": {}},
        "status": "draft",
        "steps": [
            {"step_id": "s1", "type": "message", "config": {"campaign_goal": plan.get("goal", "re-engage"), "channel": plan.get("channel_preference", "whatsapp")}, "next_step_id": None},
        ],
        "created_by_agent": True,
    }

    try:
        resp = requests.post(f"{settings.backend_url}/api/journeys", json=journey_payload, timeout=5)
        journey_id = resp.json().get("_id")
        post_progress(session_id, "journey_builder", f"Journey created: {journey_id}", step="create_journey", data={"journey_id": journey_id})
    except Exception as e:
        post_progress(session_id, "journey_builder", f"Journey creation error: {e}", step="create_journey")

    return {"current_step": "done"}


def route_from_supervisor(state: CRMAgentState) -> str:
    plan = state.get("campaign_plan", {})
    steps = plan.get("steps", [])
    if not steps:
        return END
    first = steps[0]
    if first == "segment":
        return "segment"
    if first == "analyze":
        return "analyze"
    if first == "optimize":
        return "optimize"
    if first == "create_journey":
        return "create_journey"
    return END


def post_segment_gate(state: CRMAgentState) -> str:
    """Skip full pipeline if segment found 0 customers."""
    segment = state.get("segment", {})
    if segment.get("size", 0) == 0:
        return END
    return "create_campaign"


def pre_execution_gate(state: CRMAgentState) -> str:
    messages = state.get("personalized_messages", [])
    if len(messages) > 5:
        return "await_approval"
    return "execute"


def build_graph() -> StateGraph:
    graph = StateGraph(CRMAgentState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("segment", segmentation_node)
    graph.add_node("create_campaign", campaign_creation_node)
    graph.add_node("personalize", personalization_node)
    graph.add_node("select_channel", channel_selection_node)
    graph.add_node("await_approval", human_approval_node)
    graph.add_node("execute", execution_node)
    graph.add_node("analyze", analytics_node)
    graph.add_node("optimize", optimization_node)
    graph.add_node("create_journey", create_journey_node)

    graph.set_entry_point("supervisor")

    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "segment": "segment",
            "analyze": "analyze",
            "optimize": "optimize",
            "create_journey": "create_journey",
            END: END,
        },
    )

    graph.add_conditional_edges(
        "segment",
        post_segment_gate,
        {"create_campaign": "create_campaign", END: END},
    )
    graph.add_edge("create_campaign", "personalize")
    graph.add_edge("personalize", "select_channel")

    graph.add_conditional_edges(
        "select_channel",
        pre_execution_gate,
        {
            "await_approval": "await_approval",
            "execute": "execute",
        },
    )

    graph.add_edge("await_approval", "execute")
    graph.add_edge("execute", "analyze")
    graph.add_edge("analyze", "optimize")
    graph.add_edge("optimize", END)
    graph.add_edge("create_journey", END)

    return graph


def compile_graph():
    graph = build_graph()
    return graph.compile(interrupt_before=["await_approval"])


compiled_graph = compile_graph()
