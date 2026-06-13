import json
from typing import Any
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


class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        from datetime import datetime
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


@tool
def query_customers_by_pipeline(pipeline_json: str) -> str:
    """Execute a MongoDB aggregation pipeline on the customers collection.
    Input must be a JSON string representing a list of pipeline stages.
    Returns JSON list of matching customer documents (max 1000).
    """
    try:
        pipeline = json.loads(pipeline_json)
        db = get_db()
        results = list(db.customers.aggregate(pipeline))[:1000]
        return json.dumps(results, cls=JSONEncoder)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def get_customer_profile(customer_id: str) -> str:
    """Fetch a single customer document plus their last 5 orders.
    Input: customer_id as string.
    Returns JSON with customer fields and recent_orders array.
    """
    try:
        db = get_db()
        customer = db.customers.find_one({"_id": ObjectId(customer_id)})
        if not customer:
            return json.dumps({"error": "Customer not found"})
        orders = list(
            db.orders.find({"customer_id": ObjectId(customer_id)})
            .sort("placed_at", -1)
            .limit(5)
        )
        customer["recent_orders"] = orders
        return json.dumps(customer, cls=JSONEncoder)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def save_segment(segment_json: str) -> str:
    """Persist a segment to MongoDB. Input: JSON with fields:
    name, description, criteria_nl, criteria_json (list), customer_ids (list of string IDs), size.
    Returns the inserted segment_id.
    """
    try:
        data = json.loads(segment_json)
        db = get_db()
        data["customer_ids"] = [ObjectId(cid) for cid in data.get("customer_ids", [])]
        from datetime import datetime
        data["last_refreshed_at"] = datetime.utcnow()
        data["created_by"] = "agent:segmentation"
        result = db.segments.insert_one(data)
        return json.dumps({"segment_id": str(result.inserted_id)})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def save_campaign(campaign_json: str) -> str:
    """Persist a campaign draft to MongoDB.
    Input: JSON with fields: name, goal, channel, segment_id, copy_variants (list), agent_session_id.
    Returns campaign_id.
    """
    try:
        data = json.loads(campaign_json)
        db = get_db()
        if "segment_id" in data:
            data["segment_id"] = ObjectId(data["segment_id"])
        data["created_by_agent"] = True
        data["status"] = "draft"
        from datetime import datetime
        data["created_at"] = datetime.utcnow()
        result = db.campaigns.insert_one(data)
        return json.dumps({"campaign_id": str(result.inserted_id)})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def get_campaign_communications_stats(campaign_id: str) -> str:
    """Aggregate communication stats for a campaign.
    Input: campaign_id as string.
    Returns JSON with funnel metrics: sent, delivered, opened, clicked, converted, failed.
    """
    try:
        db = get_db()
        pipeline = [
            {"$match": {"campaign_id": ObjectId(campaign_id)}},
            {
                "$group": {
                    "_id": "$campaign_id",
                    "sent": {"$sum": 1},
                    "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "opened", "clicked", "converted"]]}, 1, 0]}},
                    "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "converted"]]}, 1, 0]}},
                    "clicked": {"$sum": {"$cond": [{"$in": ["$status", ["clicked", "converted"]]}, 1, 0]}},
                    "converted": {"$sum": {"$cond": [{"$eq": ["$status", "converted"]}, 1, 0]}},
                    "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}},
                }
            },
        ]
        result = list(db.communications.aggregate(pipeline))
        if not result:
            return json.dumps({"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "converted": 0, "failed": 0})
        r = result[0]
        sent = r["sent"] or 1
        return json.dumps({
            "sent": r["sent"],
            "delivered": r["delivered"],
            "delivered_rate": round(r["delivered"] / sent * 100, 1),
            "opened": r["opened"],
            "open_rate": round(r["opened"] / sent * 100, 1),
            "clicked": r["clicked"],
            "ctr": round(r["clicked"] / sent * 100, 1),
            "converted": r["converted"],
            "conversion_rate": round(r["converted"] / sent * 100, 1),
            "failed": r["failed"],
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def save_communication(comm_json: str) -> str:
    """Persist a communication record to MongoDB.
    Input: JSON with fields: campaign_id, customer_id, channel, variant_id, personalized_body, channel_message_id.
    Returns communication_id.
    """
    try:
        data = json.loads(comm_json)
        db = get_db()
        data["campaign_id"] = ObjectId(data["campaign_id"])
        data["customer_id"] = ObjectId(data["customer_id"])
        data["status"] = "queued"
        data["events"] = [{"event": "queued", "timestamp": __import__("datetime").datetime.utcnow()}]
        result = db.communications.insert_one(data)
        return json.dumps({"communication_id": str(result.inserted_id)})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def get_customer_engagement_history(customer_id: str) -> str:
    """Get channel engagement history for a customer — open/click rates per channel.
    Input: customer_id as string.
    Returns JSON: {channel: {total, open_rate, click_rate}}.
    """
    try:
        db = get_db()
        pipeline = [
            {"$match": {"customer_id": ObjectId(customer_id)}},
            {
                "$group": {
                    "_id": "$channel",
                    "total": {"$sum": 1},
                    "opened": {"$sum": {"$cond": [{"$in": ["$status", ["opened", "clicked", "converted"]]}, 1, 0]}},
                    "clicked": {"$sum": {"$cond": [{"$in": ["$status", ["clicked", "converted"]]}, 1, 0]}},
                }
            },
        ]
        results = list(db.communications.aggregate(pipeline))
        history = {}
        for r in results:
            total = r["total"] or 1
            history[r["_id"]] = {
                "total": r["total"],
                "open_rate": round(r["opened"] / total * 100, 1),
                "click_rate": round(r["clicked"] / total * 100, 1),
            }
        return json.dumps(history)
    except Exception as e:
        return json.dumps({"error": str(e)})
