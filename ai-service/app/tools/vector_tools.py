import json
import socket
from urllib.parse import urlparse
from langchain_core.tools import tool
from app.config import settings
from app.rag.retriever import get_retriever


def is_qdrant_online() -> bool:
    try:
        parsed = urlparse(settings.qdrant_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6333
        # Use a short timeout of 0.5s to fail fast
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except Exception:
        return False


@tool
def search_past_campaigns(query: str, k: int = 5) -> str:
    """Search Qdrant for past campaigns similar to the query.
    Returns top-k campaign performance narratives to use as RAG context.
    Input: natural language query describing goal/audience/channel.
    """
    if not is_qdrant_online():
        return json.dumps([])
    try:
        retriever = get_retriever("campaign_performance", k=k)
        docs = retriever.invoke(query)
        results = [{"content": doc.page_content, "metadata": doc.metadata} for doc in docs]
        return json.dumps(results)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def search_segment_profiles(query: str, k: int = 5) -> str:
    """Search Qdrant for past segment profiles similar to the described criteria.
    Returns top-k segment descriptions to inform MongoDB pipeline generation.
    Input: natural language segment description.
    """
    if not is_qdrant_online():
        return json.dumps([])
    try:
        retriever = get_retriever("customer_segment_profiles", k=k)
        docs = retriever.invoke(query)
        results = [{"content": doc.page_content, "metadata": doc.metadata} for doc in docs]
        return json.dumps(results)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def search_brand_voice(query: str) -> str:
    """Retrieve brand voice guidelines and tone examples from Qdrant.
    Input: describe what kind of copy you're writing.
    Returns relevant brand voice chunks.
    """
    if not is_qdrant_online():
        return "Cool, dark-mode, neon cyberpunk tone. Direct and engaging."
    try:
        retriever = get_retriever("brand_voice_corpus", k=3)
        docs = retriever.invoke(query)
        return "\n\n".join([doc.page_content for doc in docs])
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def store_analytics_narrative(narrative: str, metadata_json: str = "{}") -> str:
    """Store a campaign analytics narrative in Qdrant for future RAG retrieval.
    Input: narrative (plain text performance summary), metadata_json (JSON string with campaign_id, goal, channel, open_rate, conversion_rate).
    """
    if not is_qdrant_online():
        return json.dumps({"status": "offline_skipped"})
    try:
        from app.rag.ingestion import ingest_document
        metadata = json.loads(metadata_json)
        ingest_document(
            collection="campaign_performance",
            text=narrative,
            metadata=metadata
        )
        return json.dumps({"status": "stored"})
    except Exception as e:
        return json.dumps({"error": str(e)})

