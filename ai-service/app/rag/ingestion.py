from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from app.rag.embeddings import get_embeddings
from app.config import settings

VECTOR_SIZE = 768  # all-mpnet-base-v2 output dimension


def ensure_collection(client: QdrantClient, collection_name: str):
    existing = [c.name for c in client.get_collections().collections]
    if collection_name not in existing:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print(f"Created Qdrant collection: {collection_name}")


def ingest_document(collection: str, text: str, metadata: dict = None):
    client = QdrantClient(url=settings.qdrant_url)
    ensure_collection(client, collection)
    doc = Document(page_content=text, metadata=metadata or {})
    QdrantVectorStore.from_documents(
        [doc],
        get_embeddings(),
        url=settings.qdrant_url,
        collection_name=collection,
        force_recreate=False,
    )


def ingest_documents(collection: str, texts: list[str], metadatas: list[dict] = None):
    client = QdrantClient(url=settings.qdrant_url)
    ensure_collection(client, collection)
    docs = [
        Document(page_content=text, metadata=(metadatas[i] if metadatas else {}))
        for i, text in enumerate(texts)
    ]
    QdrantVectorStore.from_documents(
        docs,
        get_embeddings(),
        url=settings.qdrant_url,
        collection_name=collection,
        force_recreate=False,
    )
    print(f"Ingested {len(docs)} documents into '{collection}'")
