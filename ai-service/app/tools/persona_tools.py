import json
from langchain_core.tools import tool
from pymongo import MongoClient
from bson import ObjectId
from app.config import settings

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri)
    return _client["crm"]


class _JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        from datetime import datetime
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def _fetch_persona(customer_id: str) -> dict:
    """Internal: fetch CustomerPersona from MongoDB. Returns dict or {}."""
    try:
        db = get_db()
        doc = db.customerpersonas.find_one({"customer_id": ObjectId(customer_id)})
        if not doc:
            # Try alternate collection name used by mongoose (lowercase plural)
            doc = db.customer_personas.find_one({"customer_id": ObjectId(customer_id)})
        return doc or {}
    except Exception:
        return {}


@tool
def get_customer_persona(customer_id: str) -> str:
    """Fetch AI persona for a customer — RFM scores, channel affinity, predicted probabilities,
    recommended action, and best send time.
    Input: customer_id string.
    Returns JSON with rfm, channel_affinity, predicted, engagement, recommended_action fields."""
    persona = _fetch_persona(customer_id)
    if not persona:
        return json.dumps({"found": False, "customer_id": customer_id})
    return json.dumps(persona, cls=_JSONEncoder)


@tool
def get_channel_affinity(customer_id: str) -> str:
    """Get per-channel affinity scores (0-1) for a customer from their AI persona.
    Returns JSON: {whatsapp, email, sms, best_channel, best_send_hour}.
    Use this in channel selection to pick the optimal channel per customer."""
    persona = _fetch_persona(customer_id)
    if not persona:
        return json.dumps({
            "found": False,
            "whatsapp": 0.6,
            "email": 0.4,
            "sms": 0.3,
            "best_channel": "whatsapp",
            "best_send_hour": 19,
        })

    affinity = persona.get("channel_affinity", {})
    engagement = persona.get("engagement", {})

    # pick best channel by affinity score
    channels = {"whatsapp": affinity.get("whatsapp", 0.5), "email": affinity.get("email", 0.4), "sms": affinity.get("sms", 0.3)}
    best_channel = max(channels, key=lambda k: channels[k])
    best_channel = engagement.get("best_channel", best_channel)

    return json.dumps({
        "found": True,
        "whatsapp": round(affinity.get("whatsapp", 0.5), 3),
        "email": round(affinity.get("email", 0.4), 3),
        "sms": round(affinity.get("sms", 0.3), 3),
        "best_channel": best_channel,
        "best_send_hour": engagement.get("best_send_hour", 19),
    })


@tool
def get_persona_recommendation(customer_id: str) -> str:
    """Get AI-recommended action and message hint for a customer.
    Returns JSON: {action, message_hint, urgency, next_order_probability, winback_probability,
    churn_probability, propensity_score, offer_sensitivity}.
    Use in personalization to pick the right angle for each customer."""
    persona = _fetch_persona(customer_id)
    if not persona:
        return json.dumps({
            "found": False,
            "action": "nurture",
            "message_hint": "",
            "urgency": "low",
            "next_order_probability": 0.5,
            "winback_probability": 0.3,
            "churn_probability": 0.3,
            "propensity_score": 50,
            "offer_sensitivity": 0.5,
        })

    rec = persona.get("recommended_action", {})
    pred = persona.get("predicted", {})
    eng = persona.get("engagement", {})

    return json.dumps({
        "found": True,
        "action": rec.get("action", "nurture"),
        "message_hint": rec.get("message_hint", ""),
        "urgency": rec.get("urgency", "low"),
        "best_send_at": rec.get("best_send_at", ""),
        "best_send_hour": eng.get("best_send_hour", 19),
        "next_order_probability": pred.get("next_order_probability", 0.5),
        "winback_probability": pred.get("winback_probability", 0.3),
        "churn_probability": pred.get("churn_probability", 0.3),
        "propensity_score": pred.get("propensity_score", 50),
        "offer_sensitivity": pred.get("offer_sensitivity", 0.5),
        "next_purchase_days": pred.get("next_purchase_days", 30),
        "rfm_segment": persona.get("rfm", {}).get("segment", "Potential"),
    })
