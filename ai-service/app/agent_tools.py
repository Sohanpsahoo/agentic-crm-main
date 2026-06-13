import json
import httpx
from langchain_core.tools import tool
from app.config import settings

@tool
def get_campaigns(status: str = "all") -> str:
    """Fetch a list of marketing campaigns. Optionally filter by status (e.g., 'active', 'draft', 'completed'). Pass 'all' to get all campaigns."""
    try:
        url = f"{settings.backend_url}/api/campaigns"
        params = {"limit": 5}
        if status and status != "all":
            params["status"] = status
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            campaigns = data.get("campaigns", [])
            result = [{"id": c.get("_id"), "name": c.get("name"), "status": c.get("status"), "goal": c.get("goal")} for c in campaigns[:5]]
            return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def get_campaign_analytics(campaign_id: str) -> str:
    """Fetch the analytics, funnel metrics, and performance data for a specific campaign ID."""
    try:
        url = f"{settings.backend_url}/api/campaigns/{campaign_id}/analytics"
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()
            result = {"funnel": data.get("funnel"), "timing": data.get("timing")}
            return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def get_segments(request: str = "all") -> str:
    """Fetch the available customer segments that can be targeted for campaigns. Pass 'all' as the request."""
    try:
        url = f"{settings.backend_url}/api/segments"
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()
            result = [{"id": s.get("_id"), "name": s.get("name"), "size": s.get("size")} for s in data]
            return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def get_customers(limit: int = 10) -> str:
    """Fetch a list of recent customers."""
    try:
        url = f"{settings.backend_url}/api/customers"
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, params={"limit": limit})
            response.raise_for_status()
            data = response.json()
            customers = data.get("customers", [])
            result = [{"id": c.get("_id"), "name": c.get("name"), "email": c.get("email"), "phone": c.get("phone")} for c in customers]
            return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def launch_campaign(directive: str) -> str:
    """Launch a marketing campaign based on a natural language directive (e.g., 'Run an email campaign targeting VIPs offering 20% off'). 
    Use this to trigger the execution pipeline for a new campaign."""
    import uuid
    from app.main import run_graph_background, sessions
    import threading
    
    session_id = str(uuid.uuid4())
    sessions[session_id] = {"status": "running"}
    
    t = threading.Thread(target=run_graph_background, args=(session_id, directive, {}))
    t.start()
    
    return json.dumps({"status": "started", "session_id": session_id, "message": "Campaign graph execution started in the background."})
