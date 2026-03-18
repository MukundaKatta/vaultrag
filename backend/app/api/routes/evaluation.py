from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.evaluation import evaluate_retrieval
from app.models.schemas import EvalRequest, EvalResponse

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.post("", response_model=EvalResponse)
async def run_evaluation(request: EvalRequest, user: dict = Depends(get_current_user)):
    db = get_supabase()
    kb = db.table("knowledge_bases").select("*").eq("id", request.knowledge_base_id).single().execute()
    if not kb.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    return await evaluate_retrieval(request, kb.data["embedding_model"])
