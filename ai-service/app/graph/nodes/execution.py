import uuid
import httpx
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from app.graph.state import CRMAgentState
from app.utils.callbacks import post_progress
from app.config import settings

BATCH_SIZE = 50

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri)
    return _client["crm"]


def _bulk_fetch_phones(customer_ids: list) -> dict:
    """Fetch phone numbers for all customers in one query. Returns {id_str: phone}."""
    if not customer_ids:
        return {}
    try:
        db = get_db()
        cursor = db.customers.find(
            {"_id": {"$in": [ObjectId(cid) for cid in customer_ids if cid]}},
            {"_id": 1, "phone": 1},
        )
        return {str(c["_id"]): c.get("phone", "") for c in cursor}
    except Exception:
        return {}


def _bulk_save_communications(records: list) -> None:
    """Bulk insert all communication records in one round-trip."""
    if not records:
        return
    try:
        db = get_db()
        db.communications.insert_many(records, ordered=False)
    except Exception as e:
        print(f"[execution] Bulk comm insert error: {e}")


def execution_node(state: CRMAgentState) -> dict:
    messages = state.get("personalized_messages", [])
    assignments = state.get("channel_assignments", [])
    campaign_draft = state.get("campaign_draft", {})

    campaign_id = campaign_draft.get("campaign_id")

    if not messages:
        return {"execution_records": [], "current_step": "analyze"}

    # Bulk fetch phone numbers upfront (single DB round-trip)
    all_customer_ids = [m["customer_id"] for m in messages if m.get("customer_id")]
    phone_map = _bulk_fetch_phones(all_customer_ids)

    # Build assignment lookup
    channel_map = {a["customer_id"]: a for a in (assignments or [])}

    post_progress(
        state["session_id"],
        "execution",
        f"Dispatching {len(messages)} messages...",
        step="execute",
    )

    channel_service_url = settings.channel_service_url
    backend_url = settings.backend_url

    execution_records = []
    send_batch = []
    comm_records = []
    now = datetime.utcnow()

    for msg in messages:
        customer_id = msg.get("customer_id")
        if not customer_id:
            continue
        assignment = channel_map.get(customer_id, {})
        channel = assignment.get("channel", "whatsapp")
        message_id = str(uuid.uuid4())

        # Use real phone number for WhatsApp; fallback to stub ID for email/sms simulation
        phone = phone_map.get(customer_id, "")
        recipient = phone if (channel == "whatsapp" and phone) else f"customer_{customer_id}"

        # Substitute promo code into message body if present
        body = msg.get("message_body", "")
        promo = msg.get("promo_code")
        if promo:
            body = body.replace("{{promo_code}}", promo).replace("{promo_code}", promo)

        send_batch.append({
            "message_id": message_id,
            "recipient": recipient,
            "channel": channel,
            "message": body,
            "campaign_id": campaign_id,
            "customer_id": customer_id,
        })

        # Prepare comm record for bulk insert
        comm_records.append({
            "campaign_id": ObjectId(campaign_id) if campaign_id and campaign_id != "000000000000000000000000" else ObjectId(),
            "customer_id": ObjectId(customer_id),
            "channel": channel,
            "variant_id": msg.get("variant_id", "A"),
            "personalized_body": msg.get("message_body", ""),
            "channel_message_id": message_id,
            "offer_id": ObjectId(msg["offer_id"]) if msg.get("offer_id") else None,
            "status": "queued",
            "events": [{"event": "queued", "timestamp": now}],
            "created_at": now,
        })

        execution_records.append({
            "customer_id": customer_id,
            "channel": channel,
            "channel_message_id": message_id,
            "status": "queued",
        })

    # Bulk save all communications in one DB call
    _bulk_save_communications(comm_records)

    # Dispatch batches to channel service
    sent_count = 0
    failed_count = 0
    for i in range(0, len(send_batch), BATCH_SIZE):
        batch = send_batch[i: i + BATCH_SIZE]
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(f"{channel_service_url}/send/batch", json={"messages": batch})
                if resp.status_code == 202:
                    sent_count += len(batch)
                else:
                    failed_count += len(batch)
        except Exception as e:
            failed_count += len(batch)
            print(f"[execution] Batch send error: {e}")

        post_progress(
            state["session_id"],
            "execution",
            f"Sent {min(i + BATCH_SIZE, len(send_batch))}/{len(send_batch)} messages",
            step="execute",
        )

    # Update campaign status to running
    if campaign_id:
        try:
            with httpx.Client(timeout=10.0) as client:
                client.patch(
                    f"{backend_url}/api/campaigns/{campaign_id}/status",
                    json={"status": "running"},
                )
        except Exception:
            pass

    post_progress(
        state["session_id"],
        "execution",
        f"Dispatched {sent_count} messages. {failed_count} failed.",
        step="execute",
        data={"sent": sent_count, "failed": failed_count},
    )

    return {
        "execution_records": execution_records,
        "current_step": "analyze",
    }
