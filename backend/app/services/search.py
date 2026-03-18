from __future__ import annotations
import math
import re
from rank_bm25 import BM25Okapi
from app.core.database import get_supabase
from app.services.embeddings import embed_texts
from app.models.schemas import SearchResult


async def vector_search(
    query: str,
    knowledge_base_id: str,
    embedding_model: str,
    top_k: int = 10,
) -> list[dict]:
    db = get_supabase()
    query_embedding = await embed_texts([query], model_id=embedding_model)
    if not query_embedding:
        return []

    result = db.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding[0],
            "match_count": top_k,
            "kb_id": knowledge_base_id,
        },
    ).execute()

    return result.data or []


def keyword_search(
    query: str,
    chunks: list[dict],
    top_k: int = 10,
) -> list[dict]:
    if not chunks:
        return []

    tokenized_corpus = [_tokenize(c["content"]) for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus)
    query_tokens = _tokenize(query)
    scores = bm25.get_scores(query_tokens)

    scored = [(chunks[i], float(scores[i])) for i in range(len(chunks))]
    scored.sort(key=lambda x: x[1], reverse=True)

    results = []
    for chunk, score in scored[:top_k]:
        results.append({**chunk, "score": score})
    return results


async def hybrid_search(
    query: str,
    knowledge_base_id: str,
    embedding_model: str,
    vector_weight: float = 0.7,
    top_k: int = 10,
) -> list[dict]:
    db = get_supabase()

    # Fetch all chunks for BM25
    all_chunks_result = db.table("chunks").select("*").eq(
        "knowledge_base_id", knowledge_base_id
    ).execute()
    all_chunks = all_chunks_result.data or []

    # Run both searches
    vector_results = await vector_search(query, knowledge_base_id, embedding_model, top_k=top_k * 2)
    bm25_results = keyword_search(query, all_chunks, top_k=top_k * 2)

    # Normalize scores
    vector_scores: dict[str, float] = {}
    if vector_results:
        max_vs = max(r.get("similarity", 0) for r in vector_results) or 1.0
        for r in vector_results:
            vector_scores[r["id"]] = r.get("similarity", 0) / max_vs

    bm25_scores: dict[str, float] = {}
    if bm25_results:
        max_bs = max(r.get("score", 0) for r in bm25_results) or 1.0
        for r in bm25_results:
            bm25_scores[r["id"]] = r.get("score", 0) / max_bs

    # Combine
    keyword_weight = 1.0 - vector_weight
    all_ids = set(vector_scores.keys()) | set(bm25_scores.keys())
    combined: list[tuple[str, float]] = []

    chunk_lookup = {c["id"]: c for c in all_chunks}
    for r in vector_results:
        chunk_lookup[r["id"]] = r

    for cid in all_ids:
        vs = vector_scores.get(cid, 0.0)
        bs = bm25_scores.get(cid, 0.0)
        score = vector_weight * vs + keyword_weight * bs
        combined.append((cid, score))

    combined.sort(key=lambda x: x[1], reverse=True)

    results = []
    for cid, score in combined[:top_k]:
        chunk = chunk_lookup.get(cid, {})
        results.append({**chunk, "score": score})

    return results


async def search_chunks(
    query: str,
    knowledge_base_id: str,
    embedding_model: str,
    mode: str = "hybrid",
    vector_weight: float = 0.7,
    top_k: int = 10,
) -> list[dict]:
    if mode == "vector":
        results = await vector_search(query, knowledge_base_id, embedding_model, top_k)
        for r in results:
            if "similarity" in r and "score" not in r:
                r["score"] = r["similarity"]
        return results
    elif mode == "keyword":
        db = get_supabase()
        all_chunks_result = db.table("chunks").select("*").eq(
            "knowledge_base_id", knowledge_base_id
        ).execute()
        return keyword_search(query, all_chunks_result.data or [], top_k)
    else:
        return await hybrid_search(query, knowledge_base_id, embedding_model, vector_weight, top_k)


def _tokenize(text: str) -> list[str]:
    return re.findall(r'\w+', text.lower())
