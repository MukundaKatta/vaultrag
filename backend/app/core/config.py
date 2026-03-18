from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    database_url: str = ""
    openai_api_key: str = ""
    cohere_api_key: str = ""
    jwt_secret: str = "change-me-in-production-min-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440
    redis_url: str = "redis://localhost:6379/0"
    frontend_url: str = "http://localhost:3000"
    max_upload_size_mb: int = 50
    default_chunk_size: int = 512
    default_chunk_overlap: int = 50
    default_embedding_model: str = "openai"
    default_embedding_dimension: int = 1536

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
