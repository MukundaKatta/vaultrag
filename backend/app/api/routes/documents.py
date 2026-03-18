from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.ingestion import ingest_document
from app.services.chunking import ChunkingConfig
from app.models.schemas import DocumentResponse, DocumentListResponse, ChunkingStrategy

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".csv", ".html", ".htm", ".md", ".markdown", ".txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    knowledge_base_id: str = Form(...),
    chunking_strategy: ChunkingStrategy = Form("recursive"),
    chunk_size: int = Form(512),
    chunk_overlap: int = Form(50),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    # Validate KB access
    db = get_supabase()
    kb = db.table("knowledge_bases").select("*").eq("id", knowledge_base_id).single().execute()
    if not kb.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if kb.data["owner_id"] != user["id"]:
        perm = db.table("permissions").select("id").eq("user_id", user["id"]).eq(
            "resource_type", "knowledge_base"
        ).eq("resource_id", knowledge_base_id).eq("permission", "write").execute()
        if not perm.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write access required")

    # Validate file
    filename = file.filename or "unknown"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 50MB)")

    # Create document record
    now = datetime.now(timezone.utc).isoformat()
    doc_id = str(uuid.uuid4())
    doc = {
        "id": doc_id,
        "knowledge_base_id": knowledge_base_id,
        "filename": filename,
        "file_type": ext,
        "file_size": len(content),
        "status": "processing",
        "chunk_count": 0,
        "metadata": {},
        "created_at": now,
        "updated_at": now,
    }
    db.table("documents").insert(doc).execute()

    # Start background ingestion
    chunking_config = ChunkingConfig(
        strategy=chunking_strategy,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    background_tasks.add_task(
        ingest_document,
        document_id=doc_id,
        knowledge_base_id=knowledge_base_id,
        filename=filename,
        content=content,
        chunking_config=chunking_config,
        embedding_model=kb.data["embedding_model"],
    )

    return DocumentResponse(**doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    knowledge_base_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_supabase()
    result = db.table("documents").select("*", count="exact").eq(
        "knowledge_base_id", knowledge_base_id
    ).order("created_at", desc=True).execute()

    docs = result.data or []
    return DocumentListResponse(
        documents=[DocumentResponse(**d) for d in docs],
        total=result.count or len(docs),
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("documents").select("*").eq("id", doc_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentResponse(**result.data)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    doc = db.table("documents").select("*").eq("id", doc_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    kb = db.table("knowledge_bases").select("owner_id").eq("id", doc.data["knowledge_base_id"]).single().execute()
    if kb.data and kb.data["owner_id"] != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only KB owner can delete documents")

    db.table("chunks").delete().eq("document_id", doc_id).execute()
    db.table("ingestion_jobs").delete().eq("document_id", doc_id).execute()
    db.table("documents").delete().eq("id", doc_id).execute()

    # Update KB counts
    if doc.data:
        from app.services.ingestion import _update_kb_counts
        _update_kb_counts(db, doc.data["knowledge_base_id"])
