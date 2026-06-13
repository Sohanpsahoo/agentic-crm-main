from pydantic import BaseModel, Field
from typing import List, Optional, Any


class MongoPipeline(BaseModel):
    pipeline: List[dict] = Field(description="Valid MongoDB aggregation pipeline stages as list of dicts")
    explanation: str = Field(description="Plain-English explanation of what this pipeline does")


class SegmentResult(BaseModel):
    segment_id: Optional[str] = None
    name: str
    description: str
    criteria_nl: str
    criteria_json: List[dict]
    customer_ids: List[str]
    size: int


class CampaignAnalyticsReport(BaseModel):
    campaign_id: str
    funnel: dict
    insights_text: str
    top_performing_variant: Optional[str] = None
    worst_performing_segment: Optional[str] = None
    recommendations: List[str] = Field(default_factory=list)
