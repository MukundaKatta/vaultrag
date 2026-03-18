from __future__ import annotations
import numpy as np
from typing import Literal
from app.core.config import get_settings
from app.models.schemas import EmbeddingModelInfo

EMBEDDING_MODELS: dict[str, EmbeddingModelInfo] = {
    "openai": EmbeddingModelInfo(
        id="openai",
        name="text-embedding-3-small",
        provider="OpenAI",
        dimension=1536,
        max_tokens=8191,
        cost_per_1k_tokens=0.00002,
        description="OpenAI's latest small embedding model, great balance of cost and quality.",
    ),
    "openai-large": EmbeddingModelInfo(
        id="openai-large",
        name="text-embedding-3-large",
        provider="OpenAI",
        dimension=3072,
        max_tokens=8191,
        cost_per_1k_tokens=0.00013,
        description="OpenAI's large embedding model for maximum quality.",
    ),
    "cohere": EmbeddingModelInfo(
        id="cohere",
        name="embed-english-v3.0",
        provider="Cohere",
        dimension=1024,
        max_tokens=512,
        cost_per_1k_tokens=0.0001,
        description="Cohere's English embedding model with strong retrieval performance.",
    ),
    "local": EmbeddingModelInfo(
        id="local",
        name="all-MiniLM-L6-v2",
        provider="sentence-transformers",
        dimension=384,
        max_tokens=256,
        cost_per_1k_tokens=0.0,
        description="Local sentence-transformers model, no API cost, runs on CPU/GPU.",
    ),
}

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _local_model


async def embed_texts(
    texts: list[str],
    model_id: str = "openai",
) -> list[list[float]]:
    if not texts:
        return []

    if model_id.startswith("openai"):
        return await _embed_openai(texts, model_id)
    elif model_id == "cohere":
        return await _embed_cohere(texts)
    elif model_id == "local":
        return _embed_local(texts)
    else:
        raise ValueError(f"Unknown embedding model: {model_id}")


async def _embed_openai(texts: list[str], model_id: str) -> list[list[float]]:
    import openai
    settings = get_settings()
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    model_name = EMBEDDING_MODELS[model_id].name
    batch_size = 100
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = await client.embeddings.create(input=batch, model=model_name)
        all_embeddings.extend([item.embedding for item in response.data])

    return all_embeddings


async def _embed_cohere(texts: list[str]) -> list[list[float]]:
    import cohere
    settings = get_settings()
    client = cohere.Client(settings.cohere_api_key)

    batch_size = 96
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = client.embed(texts=batch, model="embed-english-v3.0", input_type="search_document")
        all_embeddings.extend(response.embeddings)

    return all_embeddings


def _embed_local(texts: list[str]) -> list[list[float]]:
    model = _get_local_model()
    embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    return embeddings.tolist()


def estimate_embedding_cost(text_count: int, avg_tokens: int, model_id: str) -> float:
    model_info = EMBEDDING_MODELS.get(model_id)
    if not model_info:
        return 0.0
    total_tokens = text_count * avg_tokens
    return (total_tokens / 1000) * model_info.cost_per_1k_tokens


def get_model_info(model_id: str) -> EmbeddingModelInfo | None:
    return EMBEDDING_MODELS.get(model_id)


def list_models() -> list[EmbeddingModelInfo]:
    return list(EMBEDDING_MODELS.values())
