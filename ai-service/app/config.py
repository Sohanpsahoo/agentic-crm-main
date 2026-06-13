from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017/crm"
    qdrant_url: str = "http://localhost:6333"
    google_api_key: Optional[str] = None
    groq_api_key: str
    backend_url: str = "http://localhost:3001"
    channel_service_url: str = "http://localhost:3002"
    port: int = 8000
    gemini_model: str = "gemini-2.0-flash"
    groq_model: str = "llama-3.1-8b-instant"
    embedding_model: str = "sentence-transformers/all-mpnet-base-v2"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
