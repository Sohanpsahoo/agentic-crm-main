from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from app.rag.embeddings import get_embeddings
from app.config import settings

_client = None
_stores: dict = {}

COLLECTIONS = [
    "campaign_performance",
    "customer_segment_profiles",
    "brand_voice_corpus",
    "message_templates",
    "analytics_narratives",
]


def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.qdrant_url)
    return _client


def get_vector_store(collection: str) -> QdrantVectorStore:
    if collection not in _stores:
        _stores[collection] = QdrantVectorStore(
            client=get_qdrant_client(),
            collection_name=collection,
            embedding=get_embeddings(),
        )
    return _stores[collection]


def get_retriever(collection: str, k: int = 5):
    store = get_vector_store(collection)
    return store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k},
    )
