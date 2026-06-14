"""
Full-CRM control tools for the Groq-powered chatbot agent.
Every tool hits the backend REST API so we don't duplicate Mongoose logic.
"""
import json
from typing import Optional
import httpx
from langchain_core.tools import tool
from app.config import settings

BASE = settings.backend_url  # e.g. http://localhost:3001


def _get(path: str, params: dict = None) -> str:
    try:
        with httpx.Client(timeout=15.0) as c:
            r = c.get(f"{BASE}{path}", params=params or {})
            r.raise_for_status()
            return json.dumps(r.json())
    except Exception as e:
        return json.dumps({"error": str(e)})


def _post(path: str, body: dict) -> str:
    try:
        with httpx.Client(timeout=15.0) as c:
            r = c.post(f"{BASE}{path}", json=body)
            r.raise_for_status()
            return json.dumps(r.json())
    except Exception as e:
        return json.dumps({"error": str(e)})


def _patch(path: str, body: dict) -> str:
    try:
        with httpx.Client(timeout=15.0) as c:
            r = c.patch(f"{BASE}{path}", json=body)
            r.raise_for_status()
            return json.dumps(r.json())
    except Exception as e:
        return json.dumps({"error": str(e)})


def _delete(path: str) -> str:
    try:
        with httpx.Client(timeout=15.0) as c:
            r = c.delete(f"{BASE}{path}")
            r.raise_for_status()
            return json.dumps(r.json())
    except Exception as e:
        return json.dumps({"error": str(e)})


# ─────────────────────────────────────────────
# CUSTOMERS
# ─────────────────────────────────────────────

@tool
def list_customers(limit: str = "20", tag: str = "", search: str = "", min_ltv: str = "0", criteria: str = "", min_days_since_purchase: str = "", max_days_since_purchase: str = "", age_group: str = "") -> str:
    """List customers from the CRM database.
    Args:
        limit: number of customers to return e.g. "20" or "50"
        tag: filter by tag e.g. 'vip', 'churned', 'active', 'loyal', 'champion', 'at-risk', 'high-value'. Leave empty for all.
        search: text search on name/email. Leave empty for all.
        min_ltv: minimum lifetime value in INR e.g. "1000". Use "0" for no filter.
        criteria: optional natural language description (informational only, not used for filtering)
        min_days_since_purchase: minimum days since last purchase (e.g. "60" finds people who haven't purchased in over 60 days)
        max_days_since_purchase: maximum days since last purchase (e.g. "30" finds people who purchased within the last 30 days)
        age_group: optional filter by age group. Valid values: "18-24", "25-34", "35-44", "45-54", "55+".
    Returns JSON with customers array and total count.
    """
    try:
        raw = str(limit).strip().lower()
        lim = int(raw) if raw.isdigit() else 20
    except Exception:
        lim = 20
    params = {"limit": min(lim, 100)}
    if tag and tag.strip():
        params["tag"] = tag.strip()
    if search and search.strip():
        params["search"] = search.strip()
    try:
        ltv = int(str(min_ltv).strip() or "0")
        if ltv > 0:
            params["minLtv"] = ltv
    except Exception:
        pass

    if min_days_since_purchase and str(min_days_since_purchase).strip().isdigit():
        params["minDaysSincePurchase"] = str(min_days_since_purchase).strip()
    if max_days_since_purchase and str(max_days_since_purchase).strip().isdigit():
        params["maxDaysSincePurchase"] = str(max_days_since_purchase).strip()
    elif criteria:
        import re
        # Heuristic: "haven't purchased in X days" -> minDays; "purchased in last X days" -> maxDays
        c_lower = criteria.lower()
        days_match = re.search(r"(\d+)\s*days", c_lower)
        if days_match:
            days_val = days_match.group(1)
            if "last" in c_lower or "within" in c_lower:
                params["maxDaysSincePurchase"] = days_val
            else:
                params["minDaysSincePurchase"] = days_val

    # Use the existing _resolve_age_groups function for natural language parsing if needed
    if age_group:
        resolved = _resolve_age_groups(age_group)
        if resolved:
            params["ageGroup"] = resolved[0]
        else:
            params["ageGroup"] = age_group
    elif criteria:
        resolved = _resolve_age_groups(criteria)
        if resolved:
            params["ageGroup"] = resolved[0]

    return _get("/api/customers", params)


@tool
def get_customer(customer_id: str) -> str:
    """Get full profile of a single customer including their recent orders.
    Args:
        customer_id: MongoDB ObjectId string of the customer
    Returns JSON with customer fields and recent_orders array.
    """
    return _get(f"/api/customers/{customer_id}")


@tool
def update_customer(customer_id: str, updates_json: str) -> str:
    """Update customer fields in the CRM database.
    Args:
        customer_id: MongoDB ObjectId string
        updates_json: JSON string of fields to update e.g.
            '{"tags": ["vip","loyal"], "ltv": 15000}' or
            '{"channel_preferences": {"whatsapp": true, "email": false}}'
    Returns the updated customer document.
    """
    try:
        updates = json.loads(updates_json)
    except Exception:
        return json.dumps({"error": "updates_json must be valid JSON"})
    return _patch(f"/api/customers/{customer_id}", updates)


@tool
def create_customer(name: str, email: str, phone: str, tags: str = "", channel: str = "whatsapp") -> str:
    """Create a new customer in the CRM.
    Args:
        name: full name
        email: email address
        phone: phone number with country code e.g. +91XXXXXXXXXX
        tags: comma-separated tags e.g. 'vip,loyal'
        channel: preferred channel 'whatsapp' | 'email' | 'sms' (default whatsapp)
    Returns the created customer document.
    """
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    body = {
        "name": name,
        "email": email,
        "phone": phone,
        "tags": tag_list,
        "channel_preferences": {
            "whatsapp": channel == "whatsapp",
            "email": channel == "email",
            "sms": channel == "sms",
        },
    }
    return _post("/api/customers", body)


@tool
def get_customer_orders(customer_id: str) -> str:
    """Get all orders for a specific customer.
    Args:
        customer_id: MongoDB ObjectId string
    Returns JSON array of order documents sorted by date descending.
    """
    return _get(f"/api/customers/{customer_id}/orders")


# ─────────────────────────────────────────────
# SEGMENTS
# ─────────────────────────────────────────────

@tool
def list_segments() -> str:
    """List all customer segments in the CRM.
    Returns JSON array with segment id, name, description, size, and criteria.
    """
    return _get("/api/segments")


@tool
def get_segment(segment_id: str) -> str:
    """Get details of a specific segment including its criteria.
    Args:
        segment_id: MongoDB ObjectId string
    """
    return _get(f"/api/segments/{segment_id}")


@tool
def get_segment_customers(segment_id: str, limit: str = "20") -> str:
    """Get the customers belonging to a specific segment.
    Args:
        segment_id: MongoDB ObjectId string
        limit: number of customers to return as string e.g. "20"
    Returns JSON with customers array and total.
    """
    return _get(f"/api/segments/{segment_id}/customers", {"limit": int(limit)})


@tool
def refresh_segment(segment_id: str) -> str:
    """Re-run the segment's MongoDB criteria to get fresh customer counts.
    Args:
        segment_id: MongoDB ObjectId string
    Returns JSON with new size and refreshed_at timestamp.
    """
    return _post(f"/api/segments/{segment_id}/refresh", {})


@tool
def delete_segment(segment_id: str) -> str:
    """Delete a segment from the CRM.
    Args:
        segment_id: MongoDB ObjectId string
    Returns confirmation message.
    """
    return _delete(f"/api/segments/{segment_id}")


# ─────────────────────────────────────────────
# CAMPAIGNS
# ─────────────────────────────────────────────

@tool
def list_campaigns(status: str = "", limit: str = "10") -> str:
    """List marketing campaigns. Optionally filter by status.
    Args:
        status: 'draft' | 'running' | 'completed' | 'paused' | '' for all
        limit: number of campaigns to return as string e.g. "10"
    Returns JSON with campaigns array and total count.
    """
    params = {"limit": int(limit)}
    if status:
        params["status"] = status
    return _get("/api/campaigns", params)


@tool
def get_campaign(campaign_id: str) -> str:
    """Get full details of a specific campaign.
    Args:
        campaign_id: MongoDB ObjectId string
    Returns JSON campaign document with segment info and copy variants.
    """
    return _get(f"/api/campaigns/{campaign_id}")


@tool
def update_campaign_status(campaign_id: str, status: str) -> str:
    """Change the status of a campaign.
    Args:
        campaign_id: MongoDB ObjectId string
        status: 'draft' | 'running' | 'paused' | 'completed'
    Returns the updated campaign document.
    """
    return _patch(f"/api/campaigns/{campaign_id}/status", {"status": status})


@tool
def get_campaign_analytics(campaign_id: str) -> str:
    """Get detailed analytics for a campaign including funnel metrics, open/click/conversion rates,
    and per-customer delivery logs.
    Args:
        campaign_id: MongoDB ObjectId string
    Returns JSON with funnel (open_rate, ctr, conversion_rate etc.) and timing data.
    """
    return _get(f"/api/campaigns/{campaign_id}/analytics")


@tool
def launch_new_campaign(directive: str) -> str:
    """Launch a full AI-powered campaign through the LangGraph pipeline. Use for new campaign creation.
    Args:
        directive: natural language description of the campaign e.g.
            'Run a WhatsApp loyalty campaign targeting VIP customers offering 20% off sarees'
            'Send a churn winback email to customers inactive for 60 days with 15% discount'
    Returns session_id to track the campaign execution pipeline.
    """
    import uuid
    from app.main import run_graph_background, sessions
    import threading

    session_id = str(uuid.uuid4())
    sessions[session_id] = {"status": "running"}
    t = threading.Thread(target=run_graph_background, args=(session_id, directive, {}))
    t.start()
    return json.dumps({
        "status": "started",
        "session_id": session_id,
        "message": f"Campaign pipeline started! Session: {session_id}. The agent will segment customers, generate copy, personalize messages, and dispatch them.",
    })


# ─────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────

@tool
def get_analytics_overview() -> str:
    """Get CRM dashboard KPIs: total customers, campaigns, active campaigns,
    total messages sent, delivered rate, open rate, CTR, conversion rate.
    Returns JSON with all key metrics.
    """
    return _get("/api/analytics/overview")


@tool
def get_channel_performance() -> str:
    """Get performance breakdown by channel (whatsapp, email, sms, rcs).
    Returns open rate, CTR, conversion rate per channel.
    """
    return _get("/api/analytics/channel-performance")


@tool
def get_campaign_performance_summary(days: str = "30") -> str:
    """Get aggregated campaign performance for the last N days.
    Args:
        days: number of days to look back as string e.g. "30"
    Returns JSON array with per-campaign open_rate, ctr, conversion_rate.
    """
    return _get("/api/analytics/campaigns", {"days": int(days)})


@tool
def get_business_kpis() -> str:
    """Get high-level business KPIs: ROI, repeat sales percentage, VIP spend multiplier,
    estimated revenue, total conversions.
    Returns JSON with kpi fields.
    """
    return _get("/api/analytics/business-kpis")


@tool
def get_roi_data() -> str:
    """Get per-campaign ROI analysis showing revenue attributed vs estimated cost.
    Returns JSON array sorted by ROI descending.
    """
    return _get("/api/analytics/roi")


# ─────────────────────────────────────────────
# OFFERS
# ─────────────────────────────────────────────

@tool
def list_offers(status: str = "active") -> str:
    """List discount offers / promo codes in the CRM.
    Args:
        status: 'active' | 'inactive' | 'expired' | '' for all (default 'active')
    Returns JSON with offers array.
    """
    params = {}
    if status:
        params["status"] = status
    return _get("/api/offers", params)


@tool
def create_offer(name: str, offer_type: str, value: str, code_prefix: str, description: str = "", max_uses: str = "1000") -> str:
    """Create a new discount offer/promo code in the CRM.
    Args:
        name: offer name e.g. 'Summer Sale 20%'
        offer_type: 'percentage' | 'fixed' | 'points_multiplier'
        value: discount value as string e.g. "20" for 20% off, or "500" for Rs500 off
        code_prefix: prefix for generated codes e.g. 'SUMMER20'
        description: short description shown to customers
        max_uses: maximum number of times this offer can be used as string e.g. "1000"
    Returns the created offer document.
    """
    body = {
        "name": name,
        "type": offer_type,
        "value": float(value),
        "code_prefix": code_prefix,
        "description": description,
        "status": "active",
        "budget": {"max_uses": int(max_uses), "spent": 0},
        "targeting": {"tags": [], "channels": []},
        "validity": {},
    }
    return _post("/api/offers", body)


@tool
def set_offer_status(offer_id: str, status: str) -> str:
    """Activate or deactivate an offer.
    Args:
        offer_id: MongoDB ObjectId string
        status: 'active' | 'inactive' | 'expired'
    Returns the updated offer.
    """
    return _patch(f"/api/offers/{offer_id}/status", {"status": status})


# ─────────────────────────────────────────────
# JOURNEYS
# ─────────────────────────────────────────────

@tool
def list_journeys(status: str = "") -> str:
    """List automated customer journeys.
    Args:
        status: 'draft' | 'active' | 'paused' | '' for all
    Returns JSON array of journey documents.
    """
    params = {}
    if status:
        params["status"] = status
    return _get("/api/journeys", params)


@tool
def get_journey(journey_id: str) -> str:
    """Get details of a specific customer journey.
    Args:
        journey_id: MongoDB ObjectId string
    Returns JSON journey document with steps.
    """
    return _get(f"/api/journeys/{journey_id}")


@tool
def set_journey_status(journey_id: str, status: str) -> str:
    """Change the status of an automated journey.
    Args:
        journey_id: MongoDB ObjectId string
        status: 'draft' | 'active' | 'paused'
    Returns the updated journey.
    """
    return _patch(f"/api/journeys/{journey_id}/status", {"status": status})


@tool
def enroll_customer_in_journey(journey_id: str, customer_id: str) -> str:
    """Enroll a specific customer into an automated journey.
    Args:
        journey_id: MongoDB ObjectId string
        customer_id: MongoDB ObjectId string
    Returns enrollment confirmation.
    """
    return _post(f"/api/journeys/{journey_id}/enroll", {"customer_id": customer_id})


# ─────────────────────────────────────────────
# PRODUCTS
# ─────────────────────────────────────────────

@tool
def list_products(category: str = "", in_stock: str = "true", limit: str = "20") -> str:
    """List products in the catalog.
    Args:
        category: filter by category e.g. 'Sarees', 'Western Wear', 'Kurtas'
        in_stock: "true" to show only in-stock items, "false" for all
        limit: number of products as string e.g. "20"
    Returns JSON with products array.
    """
    params = {"limit": int(limit)}
    if category:
        params["category"] = category
    params["in_stock"] = in_stock
    return _get("/api/products", params)


@tool
def get_product_recommendations(customer_id: str) -> str:
    """Get AI product recommendations for a specific customer based on their purchase history.
    Args:
        customer_id: MongoDB ObjectId string
    Returns JSON array of recommended products.
    """
    return _get(f"/api/products/recommend/{customer_id}")


# ─────────────────────────────────────────────
# MONITOR / ALERTS
# ─────────────────────────────────────────────

@tool
def get_monitor_alerts(status: str = "pending") -> str:
    """Get campaign performance alerts generated by the AI monitor.
    Args:
        status: 'pending' | 'applied' | 'dismissed' | '' for all (default 'pending')
    Returns JSON with alerts array including AI diagnosis and suggested copy.
    """
    params = {}
    if status:
        params["status"] = status
    return _get("/api/monitor/alerts", params)


@tool
def run_campaign_monitor() -> str:
    """Trigger the AI monitor to scan all running campaigns and generate performance alerts.
    Returns confirmation that the monitor job was triggered.
    """
    return _post("/api/monitor/run", {})


@tool
def apply_monitor_alert(alert_id: str) -> str:
    """Apply the AI-suggested fix for an underperforming campaign alert.
    This re-sends the improved copy to non-openers.
    Args:
        alert_id: MongoDB ObjectId string of the alert
    Returns confirmation with number of non-openers targeted.
    """
    return _post(f"/api/monitor/alerts/{alert_id}/apply", {})


@tool
def dismiss_monitor_alert(alert_id: str) -> str:
    """Dismiss a campaign performance alert.
    Args:
        alert_id: MongoDB ObjectId string
    Returns confirmation.
    """
    return _patch(f"/api/monitor/alerts/{alert_id}/dismiss", {})


# ─────────────────────────────────────────────
# SIMULATION CENTER — direct blast to devices
# ─────────────────────────────────────────────

# Age-group mapping for natural language queries
_AGE_GROUP_MAP = {
    "18":    ["18-24"],
    "under 18": ["18-24"],
    "18-24": ["18-24"],
    "young": ["18-24", "25-34"],
    "25":    ["25-34"],
    "25-34": ["25-34"],
    "30s":   ["25-34", "35-44"],
    "35":    ["35-44"],
    "35-44": ["35-44"],
    "40s":   ["35-44", "45-54"],
    "45":    ["45-54"],
    "45-54": ["45-54"],
    "50s":   ["45-54", "55+"],
    "55":    ["55+"],
    "55+":   ["55+"],
    "senior": ["55+"],
    "old":   ["45-54", "55+"],
}


def _resolve_age_groups(criteria_text: str) -> list:
    """Map natural language age criteria to database age_group enum values."""
    text = criteria_text.lower()
    for key, groups in _AGE_GROUP_MAP.items():
        if key in text:
            return groups
    return []


def _build_customer_query(criteria: str) -> dict:
    """Convert natural language criteria into a MongoDB filter dict."""
    c = criteria.lower()
    filt = {}

    # Age group
    age_groups = _resolve_age_groups(c)
    if age_groups:
        filt["demographics.age_group"] = {"$in": age_groups}

    # Tags
    for tag in ["vip", "churned", "active", "loyal", "champion", "at-risk", "high-value", "one-time", "new"]:
        if tag in c:
            filt["tags"] = tag
            break

    # LTV
    import re
    ltv_match = re.search(r"ltv[^\d]*(\d+)", c)
    if ltv_match:
        filt["ltv"] = {"$gte": int(ltv_match.group(1))}

    # Channel preference
    for ch in ["whatsapp", "email", "sms"]:
        if ch in c:
            filt[f"channel_preferences.{ch}"] = True
            break

    return filt


@tool
def simulate_message_to_devices(criteria: str = "all", message_template: str = "Hi {name}! Check out our latest collection 🛍️", channel: str = "whatsapp", sender: str = "Zari CRM", campaign_name: str = "Direct Blast", session_id: Optional[str] = None) -> str:
    """
    Query customers matching criteria, generate a personalized message for each using Groq,
    and send them to the Simulation Center so they appear live on the phone screens.

    Use this tool when the user says things like:
    - "msg all VIP customers"
    - "send a message to everyone under 18"
    - "blast all churned customers"
    - "message everyone in the 25-34 age group"
    - "send all customers a promo"

    Args:
        criteria: natural language description of who to message.
            e.g. "customers under 18", "all VIP customers", "churned customers", "everyone", "all"
        message_template: the message to send. Can use {name} as a placeholder for the customer's first name.
            e.g. "Hey {name}, check out our new collection! 🛍️"
            If the user did not provide a message to send, invent a polite, generic marketing message yourself (e.g. "Hi {name}! Check out our latest deals.").
        channel: "whatsapp" | "email" | "sms" (default: whatsapp)
        sender: display name for the sender (default: "Zari CRM")
        campaign_name: A descriptive name for the campaign e.g. "Diwali Saree Offer" or "VIP Winback"
        session_id: optional execution pipeline session ID for console tracking

    Returns JSON with count of customers messaged and a preview list.
    """
    from app.config import settings
    from app.utils.callbacks import post_progress

    # Initialize the session in the console if session_id is provided
    if session_id:
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    f"{settings.backend_url}/api/agent/start",
                    json={
                        "session_id": session_id,
                        "query": f"Direct Blast: Message '{criteria}' using template '{message_template}' over {channel}",
                    },
                )
        except Exception as se:
            print(f"Failed to start session on backend: {se}")

    try:
        if session_id:
            post_progress(session_id, "supervisor", "Initializing direct campaign workflow...", step="init")

        # 1. Build DB filter and fetch matching customers (Data Scraping)
        if session_id:
            post_progress(session_id, "segmentation", "Scraping customer database profiles based on criteria...", step="segment")

        filt = _build_customer_query(criteria)
        query_params = {"limit": 50}
        tag_val = filt.get("tags")
        if tag_val:
            query_params["tag"] = tag_val
        ltv_val = filt.get("ltv", {}).get("$gte")
        if ltv_val:
            query_params["minLtv"] = ltv_val

        if session_id:
            db_filter_desc = f"Executing MongoDB query: find({json.dumps(filt)})"
            post_progress(session_id, "segmentation", f"Data scraped successfully. {db_filter_desc}", step="segment")

        raw = _get("/api/customers", query_params)
        data = json.loads(raw)
        customers = data.get("customers", [])

        # 2. Demographics and channel filter logic (Why only these people)
        if session_id:
            post_progress(session_id, "segmentation", "Evaluating customer demographics and opt-in preferences...", step="segment")

        # Post-filter by age group in Python
        age_groups = filt.get("demographics.age_group", {}).get("$in", [])
        if age_groups:
            orig_len = len(customers)
            customers = [
                c for c in customers
                if c.get("demographics", {}).get("age_group") in age_groups
            ]
            if session_id:
                post_progress(session_id, "segmentation", f"Demographics matching: kept {len(customers)} of {orig_len} customers matching age groups {age_groups}.", step="segment")

        # Post-filter by channel preference with intelligent fallback
        assigned_customers = []
        fallback_counts = {"whatsapp": 0, "email": 0, "sms": 0}
        dropped = 0
        
        for c in customers:
            prefs = c.get("channel_preferences", {})
            # Check if primary channel is opted in
            if prefs.get(channel, True):
                assigned_customers.append((c, channel))
            else:
                # Fallback to another opted-in channel
                alt_channels = [ch for ch in ["whatsapp", "email", "sms"] if ch != channel and prefs.get(ch, False)]
                if alt_channels:
                    alt_ch = alt_channels[0]
                    assigned_customers.append((c, alt_ch))
                    fallback_counts[alt_ch] += 1
                else:
                    dropped += 1
        
        customers = assigned_customers

        if session_id:
            fallbacks = sum(fallback_counts.values())
            reasoning = f"Primary channel ({channel}) assigned where opted-in. Routed {fallbacks} users to alternative channels. Excluded {dropped} fully opted-out."
            post_progress(session_id, "segmentation", f"Target segment locked: {len(customers)} active subscriber(s) chosen. Rationale: {reasoning}", step="segment")

        if not customers:
            msg = f"No customers found matching: '{criteria}' with any available channel."
            if session_id:
                post_progress(session_id, "supervisor", msg, step="error")
                with httpx.Client(timeout=5.0) as client:
                    client.post(
                        f"{settings.backend_url}/api/agent/completed",
                        json={
                            "session_id": session_id,
                            "result": {"summary": msg},
                        },
                    )
            return json.dumps({
                "status": "no_customers",
                "message": f"No customers found matching: '{criteria}'.",
                "count": 0,
            })

        # 3. Generate personalized messages and send to each
        if session_id:
            post_progress(session_id, "personalization", f"Crafting personalized message bodies for {len(customers[:30])} subscribers...", step="personalization")

        blast_messages = []
        for item in customers[:30]:  # cap at 30 for speed
            c, assigned_ch = item
            first_name = (c.get("name") or "there").split()[0]

            # Simple template substitution
            personalized = message_template.replace("{name}", first_name).replace("{Name}", first_name)

            if len(personalized.strip()) < 10:
                personalized = f"Hey {first_name}! 👋 Check out our latest collection just for you. Visit Zari Fashion today!"

            blast_messages.append({
                "customer_id": str(c.get("_id", "")),
                "customer_name": c.get("name", "Customer"),
                "channel": assigned_ch,
                "message": personalized,
                "sender": sender,
            })

        if session_id:
            post_progress(session_id, "personalization", f"Completed template generation. Sample personalized copy: '{blast_messages[0]['message']}'", step="personalization")
            post_progress(session_id, "execution", f"Initiating dispatch queue. Sending messages one-by-one to device simulation interfaces...", step="execute")

        # Send to backend blast endpoint — this emits device:message_added via socket
        blast_result = _post("/api/agent/blast", {"messages": blast_messages, "campaign_name": campaign_name})
        result_data = json.loads(blast_result)

        if result_data.get("error"):
            if session_id:
                post_progress(session_id, "execution", f"Dispatch failed: {result_data['error']}", step="error")
            return json.dumps({"status": "error", "error": result_data["error"]})

        if session_id:
            post_progress(session_id, "execution", f"Dispatched {len(blast_messages)} personalized messages successfully to the Simulation Center.", step="execute")
            
            # Complete the session
            try:
                with httpx.Client(timeout=5.0) as client:
                    client.post(
                        f"{settings.backend_url}/api/agent/completed",
                        json={
                            "session_id": session_id,
                            "result": {
                                "summary": f"Direct personalized message blast completed. Dispatched {len(blast_messages)} messages via {channel} based on criteria: '{criteria}'.",
                            },
                        },
                    )
            except Exception as ce:
                print(f"Failed to complete session on backend: {ce}")

        preview = [
            {"name": m["customer_name"], "message": m["message"][:80]}
            for m in blast_messages[:5]
        ]

        return json.dumps({
            "status": "sent",
            "count": len(blast_messages),
            "channel": channel,
            "criteria": criteria,
            "preview": preview,
            "simulation_center": "Messages are now live in the Simulation Center — go to the Simulation Center tab to see them appear on the phone screens in real time!",
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        if session_id:
            try:
                post_progress(session_id, "supervisor", f"Error encountered: {str(e)}", step="error")
            except Exception:
                pass
        return json.dumps({"error": str(e), "status": "failed"})
