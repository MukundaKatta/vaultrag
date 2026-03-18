from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.models.schemas import IngestionJob, IngestionStats
from app.services.embeddings import list_models, EmbeddingModelInfo

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.get("/jobs", response_model=list[IngestionJob])
async def list_jobs(
    knowledge_base_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_supabase()

    if knowledge_base_id:
        docs = db.table("documents").select("id,filename").eq(
            "knowledge_base_id", knowledge_base_id
        ).execute()
        doc_ids = [d["id"] for d in (docs.data or [])]
        doc_names = {d["id"]: d["filename"] for d in (docs.data or [])}

        if not doc_ids:
            return []

        jobs = db.table("ingestion_jobs").select("*").in_("document_id", doc_ids).order(
            "started_at", desc=True
        ).execute()
    else:
        jobs = db.table("ingestion_jobs").select("*").order("started_at", desc=True).limit(50).execute()
        doc_ids_in_jobs = list({j["document_id"] for j in (jobs.data or [])})
        if doc_ids_in_jobs:
            docs = db.table("documents").select("id,filename").in_("id", doc_ids_in_jobs).execute()
            doc_names = {d["id"]: d["filename"] for d in (docs.data or [])}
        else:
            doc_names = {}

    results = []
    for j in (jobs.data or []):
        results.append(IngestionJob(
            id=j["id"],
            document_id=j["document_id"],
            filename=doc_names.get(j["document_id"], "Unknown"),
            status=j["status"],
            progress=j.get("progress", 0),
            chunk_count=j.get("chunk_count", 0),
            error_message=j.get("error_message"),
            estimated_cost=j.get("estimated_cost"),
            started_at=j.get("started_at"),
            completed_at=j.get("completed_at"),
        ))
    return results


@router.get("/jobs/{job_id}", response_model=IngestionJob)
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    j = db.table("ingestion_jobs").select("*").eq("id", job_id).single().execute()
    if not j.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    doc = db.table("documents").select("filename").eq("id", j.data["document_id"]).single().execute()
    filename = doc.data["filename"] if doc.data else "Unknown"

    return IngestionJob(
        id=j.data["id"],
        document_id=j.data["document_id"],
        filename=filename,
        status=j.data["status"],
        progress=j.data.get("progress", 0),
        chunk_count=j.data.get("chunk_count", 0),
        error_message=j.data.get("error_message"),
        estimated_cost=j.data.get("estimated_cost"),
        started_at=j.data.get("started_at"),
        completed_at=j.data.get("completed_at"),
    )


@router.get("/stats/{knowledge_base_id}", response_model=IngestionStats)
async def get_stats(knowledge_base_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()

    docs = db.table("documents").select("*").eq("knowledge_base_id", knowledge_base_id).execute()
    all_docs = docs.data or []

    total_docs = len(all_docs)
    processing = sum(1 for d in all_docs if d["status"] == "processing")
    completed = sum(1 for d in all_docs if d["status"] == "ready")
    failed = sum(1 for d in all_docs if d["status"] == "failed")
    total_chunks = sum(d.get("chunk_count", 0) for d in all_docs)

    doc_ids = [d["id"] for d in all_docs]
    total_cost = 0.0
    if doc_ids:
        jobs = db.table("ingestion_jobs").select("estimated_cost").in_("document_id", doc_ids).execute()
        total_cost = sum(j.get("estimated_cost", 0) or 0 for j in (jobs.data or []))

    return IngestionStats(
        total_documents=total_docs,
        total_chunks=total_chunks,
        documents_processing=processing,
        documents_completed=completed,
        documents_failed=failed,
        estimated_total_cost=round(total_cost, 6),
    )


@router.get("/embedding-models", response_model=list[EmbeddingModelInfo])
async def get_embedding_models(user: dict = Depends(get_current_user)):
    return list_models()
