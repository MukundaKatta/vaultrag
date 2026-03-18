from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.search import search_chunks
from app.services.query_rewriter import rewrite_query
from app.services.parsers import get_page_for_offset, get_paragraph_for_offset
from app.models.schemas import SearchRequest, SearchResponse, SearchResult

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(request: SearchRequest, user: dict = Depends(get_current_user)):
    db = get_supabase()
    kb = db.table("knowledge_bases").select("*").eq("id", request.knowledge_base_id).single().execute()
    if not kb.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    query = request.query
    rewritten = None
    if request.rewrite:
        rewritten = await rewrite_query(query)
        query = rewritten

    results = await search_chunks(
        query=query,
        knowledge_base_id=request.knowledge_base_id,
        embedding_model=kb.data["embedding_model"],
        mode=request.mode,
        vector_weight=request.vector_weight,
        top_k=request.top_k,
    )

    search_results: list[SearchResult] = []
    for chunk in results:
        doc_id = chunk.get("document_id", "")
        doc = db.table("documents").select("filename,metadata").eq("id", doc_id).single().execute()
        doc_name = doc.data["filename"] if doc.data else "Unknown"
        doc_meta = doc.data.get("metadata", {}) if doc.data else {}

        page = None
        paragraph = None
        offset = chunk.get("start_offset", 0)
        if doc_meta.get("page_map"):
            page = get_page_for_offset(offset, doc_meta["page_map"])
        if doc_meta.get("para_map"):
            paragraph = get_paragraph_for_offset(offset, doc_meta["para_map"])

        search_results.append(SearchResult(
            chunk_id=chunk.get("id", ""),
            document_id=doc_id,
            document_name=doc_name,
            text=chunk.get("content", ""),
            score=chunk.get("score", 0.0),
            page=page,
            paragraph=paragraph,
            metadata=chunk.get("metadata", {}),
        ))

    return SearchResponse(
        results=search_results,
        total=len(search_results),
        query=request.query,
        rewritten_query=rewritten,
        mode=request.mode,
    )
