import json
import random
import string
from langchain_core.tools import tool
from app.config import settings
from pymongo import MongoClient

_mongo_client = None


def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.mongodb_uri)
    return _mongo_client["crm"]


@tool
def get_active_offers(tags: str = "", channel: str = "") -> str:
    """Fetch active offers from the database. Filter by customer tags (comma-separated) and channel.
    Returns JSON list of offers with id, name, type, value, code_prefix."""
    db = get_db()
    try:
        query = {"status": "active"}
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
            if tag_list:
                query["targeting.tags"] = {"$in": tag_list}
        if channel:
            query["$or"] = [
                {"targeting.channels": channel},
                {"targeting.channels": {"$size": 0}},
            ]

        offers = list(db.offers.find(query, {"codes": 0}).limit(10))
        result = []
        for o in offers:
            result.append({
                "offer_id": str(o["_id"]),
                "name": o["name"],
                "description": o.get("description", ""),
                "type": o["type"],
                "value": o["value"],
                "code_prefix": o.get("code_prefix", "OFFER"),
                "uses_remaining": o["budget"]["max_uses"] - len(o.get("codes", [])),
            })
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def select_best_offer(customer_id: str, campaign_goal: str) -> str:
    """Select the most appropriate offer for a customer based on their persona and campaign goal.
    Returns JSON with offer_id, offer_text (ready to embed in message), discount_description."""
    db = get_db()
    from bson import ObjectId

    try:
        offer_sensitivity = 0.5

        customer = db.customers.find_one({"_id": ObjectId(customer_id)}, {"tags": 1, "ltv": 1})
        customer_tags = customer.get("tags", []) if customer else []
        ltv = customer.get("ltv", 0) if customer else 0

        # goal → tag mapping
        goal_tag_map = {
            "re-engage": "churned",
            "winback": "churned",
            "loyalty": "vip",
            "upsell": "vip",
            "new_customer": "new",
            "welcome": "new",
        }
        target_tag = goal_tag_map.get(campaign_goal.lower(), "")

        # find best matching offer
        query = {"status": "active"}
        if target_tag:
            query["$or"] = [
                {"targeting.tags": target_tag},
                {"targeting.tags": {"$size": 0}},
            ]

        offers = list(db.offers.find(query, {"codes": 0}).limit(5))
        if not offers:
            # fallback generic text
            return json.dumps({
                "offer_id": None,
                "offer_text": "an exclusive discount just for you",
                "discount_description": "special offer",
                "offer_type": "generic",
            })

        # pick highest value offer that fits sensitivity
        # high sensitivity → show high % off; low sensitivity → subtler offer
        best = max(offers, key=lambda o: o["value"] if offer_sensitivity > 0.5 else -o["value"])

        if best["type"] == "percentage":
            text = f"{int(best['value'])}% OFF your next purchase"
        elif best["type"] == "fixed":
            text = f"₹{int(best['value'])} off on your next order"
        elif best["type"] == "points_multiplier":
            text = f"{int(best['value'])}x loyalty points on your next purchase"
        else:
            text = "a special offer just for you"

        return json.dumps({
            "offer_id": str(best["_id"]),
            "offer_text": text,
            "discount_description": best.get("description", text),
            "offer_type": best["type"],
            "offer_value": best["value"],
            "code_prefix": best.get("code_prefix", "OFFER"),
        })
    except Exception as e:
        return json.dumps({"error": str(e), "offer_text": "a special discount", "discount_description": "offer"})


@tool
def generate_offer_code(offer_id: str, customer_id: str) -> str:
    """Generate a unique personalized offer code for a customer and save it to the offer's code list.
    Returns JSON with code string."""
    db = get_db()
    from bson import ObjectId

    try:
        offer = db.offers.find_one({"_id": ObjectId(offer_id)})
        if not offer:
            return json.dumps({"error": "Offer not found", "code": "OFFER10"})

        prefix = offer.get("code_prefix", "OFFER")
        suffix = customer_id[-6:].upper()
        rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=3))
        code = f"{prefix}_{suffix}_{rand}"

        db.offers.update_one(
            {"_id": ObjectId(offer_id)},
            {"$push": {"codes": {"code": code, "customer_id": ObjectId(customer_id), "used": False}}}
        )

        return json.dumps({"code": code, "offer_id": offer_id, "customer_id": customer_id})
    except Exception as e:
        return json.dumps({"error": str(e), "code": "OFFER10"})
