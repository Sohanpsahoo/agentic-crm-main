import httpx
from app.config import settings


def post_progress(
    session_id: str,
    agent: str,
    message: str,
    step: str = "",
    data: dict = None,
):
    """Post progress update to backend, which relays via WebSocket to frontend."""
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"{settings.backend_url}/api/agent/progress",
                json={
                    "session_id": session_id,
                    "step": step,
                    "agent": agent,
                    "message": message,
                    "data": data or {},
                },
            )
    except Exception as e:
        print(f"Progress callback failed: {e}")
