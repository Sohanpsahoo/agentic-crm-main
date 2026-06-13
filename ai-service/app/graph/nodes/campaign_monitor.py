import json
from datetime import datetime
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pymongo import MongoClient
from bson import ObjectId
from app.config import settings
from app.tools.mongo_tools import get_campaign_communications_stats

# Minimum performance thresholds per channel
THRESHOLDS = {
    "whatsapp": {"open_rate": 30.0, "ctr": 8.0,  "conversion_rate": 2.0},
    "email":    {"open_rate": 15.0, "ctr": 2.0,  "conversion_rate": 0.8},
    "sms":      {"open_rate": 20.0, "ctr": 4.0,  "conversion_rate": 1.0},
    "rcs":      {"open_rate": 25.0, "ctr": 6.0,  "conversion_rate": 1.5},
}

DIAGNOSIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a marketing campaign expert for Zari fashion brand.
A campaign is underperforming. Diagnose WHY and generate an improved message.
Be direct and specific. Format JSON exactly:
{
  "diagnosis": "<1-2 sentence explanation of why it's underperforming>",
  "suggested_copy": "<improved WhatsApp/SMS/email message body, max 160 chars>",
  "recommended_action": "resend_non_openers|pause|modify_audience"
}"""),
    ("human", """Campaign: {campaign_name}
Channel: {channel}
Goal: {goal}
Current metrics: {metrics}
Expected thresholds: {thresholds}
Failed metric: {metric_failed} (actual: {actual}%, expected: {expected}%)

Generate diagnosis + improved copy."""),
])

_mongo_client = None

def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.mongodb_uri)
    return _mongo_client["crm"]


def campaign_monitor_node(state: dict) -> dict:
    """
    Fetch all running campaigns, evaluate against thresholds,
    generate AI diagnosis + copy suggestions for underperformers.
    Returns list of alert dicts.
    """
    db = get_db()
    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.3,
    )
    chain = DIAGNOSIS_PROMPT | llm

    # Fetch all running campaigns
    running = list(db.campaigns.find({"status": "running"}).limit(50))
    alerts = []

    for campaign in running:
        cid = str(campaign["_id"])
        channel = campaign.get("channel", "whatsapp").lower()
        thresholds = THRESHOLDS.get(channel, THRESHOLDS["whatsapp"])

        metrics_raw = get_campaign_communications_stats.invoke(cid)
        try:
            metrics = json.loads(metrics_raw)
        except Exception:
            continue

        if metrics.get("sent", 0) < 5:
            continue  # too few sends to judge

        # Check each metric
        failed_metric = None
        actual_val = 0.0
        expected_val = 0.0
        severity = "warning"

        open_rate = metrics.get("open_rate", 0)
        ctr = metrics.get("ctr", 0)
        conv = metrics.get("conversion_rate", 0)

        if open_rate < thresholds["open_rate"]:
            failed_metric = "open_rate"
            actual_val = open_rate
            expected_val = thresholds["open_rate"]
            severity = "critical" if open_rate < thresholds["open_rate"] * 0.5 else "warning"
        elif ctr < thresholds["ctr"]:
            failed_metric = "ctr"
            actual_val = ctr
            expected_val = thresholds["ctr"]
            severity = "warning"
        elif conv < thresholds["conversion_rate"]:
            failed_metric = "conversion_rate"
            actual_val = conv
            expected_val = thresholds["conversion_rate"]
            severity = "warning"

        if not failed_metric:
            continue  # campaign is healthy

        # Generate AI diagnosis
        try:
            result = chain.invoke({
                "campaign_name": campaign.get("name", "Campaign"),
                "channel": channel,
                "goal": campaign.get("goal", "re-engage"),
                "metrics": json.dumps(metrics),
                "thresholds": json.dumps(thresholds),
                "metric_failed": failed_metric,
                "actual": round(actual_val, 1),
                "expected": round(expected_val, 1),
            })
            content = result.content.strip()
            # strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            diagnosis_data = json.loads(content)
        except Exception as e:
            diagnosis_data = {
                "diagnosis": f"Campaign {failed_metric} is below target.",
                "suggested_copy": campaign.get("copy_variants", [{}])[0].get("body", ""),
                "recommended_action": "resend_non_openers",
            }

        alerts.append({
            "campaign_id": cid,
            "campaign_name": campaign.get("name", ""),
            "channel": channel,
            "metric_failed": failed_metric,
            "actual_value": round(actual_val, 2),
            "expected_value": round(expected_val, 2),
            "severity": severity,
            "ai_diagnosis": diagnosis_data.get("diagnosis", ""),
            "suggested_copy": diagnosis_data.get("suggested_copy", ""),
            "recommended_action": diagnosis_data.get("recommended_action", "resend_non_openers"),
        })

    return {"alerts": alerts, "monitor_ran_at": datetime.utcnow().isoformat()}
