from langgraph.graph import StateGraph, END
from typing import TypedDict, List
from app.graph.nodes.campaign_monitor import campaign_monitor_node


class MonitorState(TypedDict):
    alerts: List[dict]
    monitor_ran_at: str


def build_monitor_graph():
    graph = StateGraph(MonitorState)
    graph.add_node("monitor", campaign_monitor_node)
    graph.set_entry_point("monitor")
    graph.add_edge("monitor", END)
    return graph


compiled_monitor = build_monitor_graph().compile()
