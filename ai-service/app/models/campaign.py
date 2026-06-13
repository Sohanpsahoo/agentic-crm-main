from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class CampaignPlan(BaseModel):
    intent: str = Field(description="Summarized marketing intent")
    steps: List[Literal["segment", "create_campaign", "personalize", "select_channel", "execute", "analyze", "optimize", "create_journey"]] = Field(
        description="Ordered execution steps"
    )
    segment_criteria: dict = Field(description="Structured criteria for segmentation")
    channel_preference: Optional[str] = Field(default=None, description="Preferred channel: whatsapp/sms/email/rcs/auto")
    goal: str = Field(description="Campaign goal: re-engage/upsell/loyalty/announce/winback/welcome")
    campaign_name: str = Field(description="Suggested campaign name. IMPORTANT: this field must be called 'campaign_name', not 'name'.")
    journey_trigger: Optional[str] = Field(default=None, description="Journey trigger type if creating an automated journey: signup/first_purchase/inactivity/birthday")
    offer_hint: Optional[dict] = Field(default=None, description="Offer/discount details extracted from query, e.g. {'discount': 0.15}")


class CopyVariant(BaseModel):
    variant_id: str
    headline: str
    body: str
    cta: str


class CampaignCopy(BaseModel):
    headline: str = Field(description="Main headline, personalized with {{first_name}} token if appropriate")
    body: str = Field(description="Message body. For WhatsApp/SMS max 160 chars. Use {{promo_code}} token.")
    cta: str = Field(description="Call to action button text")
    variants: List[CopyVariant] = Field(description="Two A/B variants", min_length=2, max_length=2)


class ChannelAssignment(BaseModel):
    customer_id: str
    channel: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    reason: str


class PersonalizedMessage(BaseModel):
    customer_id: str
    message_body: str
    subject: Optional[str] = None
    variant_id: str
    personalization_tokens: dict = Field(default_factory=dict)


class OptimizationPlan(BaseModel):
    winning_variant: str
    optimal_send_hour: int = Field(description="Recommended hour (0-23) in local timezone")
    refined_criteria: Optional[dict] = None
    next_campaign_suggestions: List[str] = Field(default_factory=list)
    summary: str
