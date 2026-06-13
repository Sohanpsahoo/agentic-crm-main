import json
import httpx
from langchain_core.tools import tool
from app.config import settings


@tool
def send_message_via_channel(send_payload_json: str) -> str:
    """Send a personalized message via the stubbed channel service.
    Input: JSON string with fields: recipient, channel, message, campaign_id, customer_id, message_id.
    Returns: JSON with channel_message_id and status.
    """
    try:
        payload = json.loads(send_payload_json)
        url = f"{settings.backend_url.replace('3001', '3002')}/send"
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload)
            return json.dumps(response.json())
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def send_batch_messages(messages_json: str) -> str:
    """Send a batch of messages to the stubbed channel service.
    Input: JSON string with field 'messages' — list of {recipient, channel, message, campaign_id, customer_id}.
    Returns: JSON with results array and count.
    """
    try:
        payload = json.loads(messages_json)
        channel_service_url = settings.backend_url.replace(":3001", ":3002")
        url = f"{channel_service_url}/send/batch"
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            return json.dumps(response.json())
    except Exception as e:
        return json.dumps({"error": str(e)})
