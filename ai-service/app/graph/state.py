from typing import TypedDict, Annotated, Optional, List
import operator


class CRMAgentState(TypedDict):
    # ── Input ──────────────────────────────────────────
    raw_query: str
    session_id: str
    context: dict

    # ── Supervisor output ──────────────────────────────
    campaign_plan: Optional[dict]           # CampaignPlan serialized

    # ── Agent outputs (accumulated) ───────────────────
    segment: Optional[dict]                 # SegmentResult serialized
    campaign_draft: Optional[dict]          # CampaignCopy + metadata
    personalized_messages: Annotated[List[dict], operator.add]
    channel_assignments: Optional[List[dict]]
    execution_records: Annotated[List[dict], operator.add]
    analytics_report: Optional[dict]        # CampaignAnalyticsReport
    optimization_plan: Optional[dict]

    # ── Control flow ───────────────────────────────────
    errors: Annotated[List[str], operator.add]
    current_step: str
    requires_approval: bool
    marketer_approval: Optional[bool]
    final_summary: Optional[str]
