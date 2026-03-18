from __future__ import annotations
from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.services.chunking import preview_chunks
from app.models.schemas import ChunkPreviewRequest, ChunkPreviewResponse

router = APIRouter(prefix="/chunking", tags=["chunking"])


@router.post("/preview", response_model=ChunkPreviewResponse)
async def chunk_preview(request: ChunkPreviewRequest, user: dict = Depends(get_current_user)):
    chunks = preview_chunks(request.text, request.config)
    total = len(chunks)
    avg_tokens = sum(c.token_count for c in chunks) / total if total > 0 else 0.0
    return ChunkPreviewResponse(chunks=chunks, total_chunks=total, avg_tokens=round(avg_tokens, 1))
