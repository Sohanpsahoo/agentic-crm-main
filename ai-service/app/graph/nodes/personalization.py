import json
import asyncio
from langchain_groq import ChatGroq
from app.config import settings
from app.prompts.personalization_prompt import PERSONALIZATION_PROMPT
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import get_customer_profile
from app.tools.offer_tools import select_best_offer, generate_offer_code
from app.tools.persona_tools import get_persona_recommendation
from app.utils.callbacks import post_progress
from pymongo import MongoClient

_mongo_client = None


def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.mongodb_uri)
    return _mongo_client["crm"]


def recommend_product_from_db(top_categories: list) -> str:
    """Fetch a real product from MongoDB matching customer categories."""
    try:
        db = get_db()
        cats = top_categories[:3] if top_categories else []
        query = {"in_stock": True}
        if cats:
            query["category"] = {"$in": cats}
        product = db.products.find_one(query, sort=[("price", -1)])
        if product:
            return product["name"]
    except Exception:
        pass
    return "New Arrivals Collection"


async def personalize_one(
    customer_id: str,
    template: str,
    variant_id: str,
    campaign_goal: str,
    llm: ChatGroq,
) -> dict:
    profile_raw = get_customer_profile.invoke(customer_id)
    try:
        profile = json.loads(profile_raw)
    except Exception:
        profile = {}

    # fetch AI persona — gives us recommended action, offer sensitivity, best send time
    persona_raw = get_persona_recommendation.invoke(customer_id)
    try:
        persona = json.loads(persona_raw)
    except Exception:
        persona = {}

    # use offer_sensitivity from persona to pick offer aggressiveness
    offer_raw = select_best_offer.invoke({"customer_id": customer_id, "campaign_goal": campaign_goal})
    try:
        offer = json.loads(offer_raw)
    except Exception:
        offer = {"offer_text": "an exclusive discount just for you"}

    # if persona has a message hint, prefer it over generic offer text
    persona_hint = persona.get("message_hint", "")
    offer_text = persona_hint if persona_hint else offer.get("offer_text", "an exclusive discount")

    # generate unique promo code if this offer has one
    promo_code = None
    if offer.get("offer_id"):
        try:
            code_raw = generate_offer_code.invoke({
                "offer_id": offer["offer_id"],
                "customer_id": customer_id,
            })
            promo_code = json.loads(code_raw).get("code")
        except Exception:
            pass

    name = profile.get("name", "there").split()[0]
    top_cats = profile.get("top_categories", [])
    last_cat = top_cats[0] if top_cats else "your favourites"
    rec_product = recommend_product_from_db(top_cats)
    avg_order = int(profile.get("avg_order_value", 1500))

    # use best_send_hour from persona (real ML signal) instead of hardcoded 19
    best_send_hour = persona.get("best_send_hour") if persona.get("found") else None
    if best_send_hour is None:
        best_send_hour = 19

    chain = PERSONALIZATION_PROMPT | llm

    result = await chain.ainvoke({
        "template_body": template,
        "customer_name": name,
        "rfm_segment": persona.get("rfm_segment", "Potential"),
        "persona_action": persona.get("action", "nurture"),
        "urgency": persona.get("urgency", "medium"),
        "last_category": last_cat,
        "top_categories": ", ".join(top_cats[:3]) if top_cats else "fashion",
        "recommended_product": rec_product,
        "avg_order_value": str(avg_order),
        "offer_text": offer_text,
    })

    content = result.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        data = json.loads(content)
    except Exception:
        data = {"message_body": result.content, "subject": None, "personalization_tokens": {}}

    return {
        "customer_id": customer_id,
        "message_body": data.get("message_body", result.content),
        "subject": data.get("subject"),
        "variant_id": variant_id,
        "personalization_tokens": data.get("personalization_tokens", {}),
        "offer_id": offer.get("offer_id"),
        "promo_code": promo_code,
        "best_send_hour": best_send_hour,
        "persona_action": persona.get("action"),
        "persona_urgency": persona.get("urgency"),
        "propensity_score": persona.get("propensity_score", 50),
    }


def personalization_node(state: CRMAgentState) -> dict:
    segment = state.get("segment", {})
    campaign_draft = state.get("campaign_draft", {})
    campaign_goal = state.get("campaign_plan", {}).get("goal") or "re-engage"
    customer_ids = segment.get("customer_ids", [])  # No longer capped at 10

    if not customer_ids:
        post_progress(state["session_id"], "personalization", "No customers to personalize", step="personalize")
        return {"personalized_messages": [], "current_step": "select_channel"}

    post_progress(
        state["session_id"],
        "personalization",
        f"Personalizing {len(customer_ids)} messages with AI offers...",
        step="personalize",
    )

    variants = campaign_draft.get("variants", [])

    def get_variant_for_idx(i):
        if len(variants) >= 2:
            return variants[i % 2]
        return variants[0] if variants else {"body": campaign_draft.get("body", ""), "variant_id": "A"}

    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.6,
        max_retries=3,  # Added backoff retries for rate limits
    )

    async def run_all():
        sem = asyncio.Semaphore(5)  # Max 5 concurrent calls to avoid rate limit spikes
        async def sem_task(cid, v):
            async with sem:
                return await personalize_one(cid, v.get("body", ""), v.get("variant_id", "A"), campaign_goal, llm)
        
        tasks = []
        for i, cid in enumerate(customer_ids):
            v = get_variant_for_idx(i)
            tasks.append(sem_task(cid, v))
        return await asyncio.gather(*tasks, return_exceptions=True)

    results = asyncio.run(run_all())
    messages = [r for r in results if isinstance(r, dict)]

    post_progress(
        state["session_id"],
        "personalization",
        f"Personalized {len(messages)} messages",
        step="personalize",
    )

    return {
        "personalized_messages": messages,
        "current_step": "select_channel",
    }
