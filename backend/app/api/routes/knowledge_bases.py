from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.models.schemas import (
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse,
)

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])


@router.post("", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(data: KnowledgeBaseCreate, user: dict = Depends(get_current_user)):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    kb_id = str(uuid.uuid4())

    kb = {
        "id": kb_id,
        "name": data.name,
        "description": data.description,
        "embedding_model": data.embedding_model,
        "embedding_dimension": data.embedding_dimension,
        "owner_id": user["id"],
        "document_count": 0,
        "chunk_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    db.table("knowledge_bases").insert(kb).execute()
    return KnowledgeBaseResponse(**kb)


@router.get("", response_model=list[KnowledgeBaseResponse])
async def list_knowledge_bases(user: dict = Depends(get_current_user)):
    db = get_supabase()
    # Owner or has permission
    owned = db.table("knowledge_bases").select("*").eq("owner_id", user["id"]).execute()
    perms = db.table("permissions").select("resource_id").eq(
        "user_id", user["id"]
    ).eq("resource_type", "knowledge_base").execute()

    perm_ids = [p["resource_id"] for p in (perms.data or [])]
    shared = []
    if perm_ids:
        shared_result = db.table("knowledge_bases").select("*").in_("id", perm_ids).execute()
        shared = shared_result.data or []

    all_kbs = (owned.data or []) + shared
    seen = set()
    unique = []
    for kb in all_kbs:
        if kb["id"] not in seen:
            seen.add(kb["id"])
            unique.append(kb)

    return [KnowledgeBaseResponse(**kb) for kb in unique]


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(kb_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("knowledge_bases").select("*").eq("id", kb_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    kb = result.data
    if kb["owner_id"] != user["id"]:
        perm = db.table("permissions").select("id").eq("user_id", user["id"]).eq(
            "resource_type", "knowledge_base"
        ).eq("resource_id", kb_id).execute()
        if not perm.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return KnowledgeBaseResponse(**kb)


@router.patch("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(kb_id: str, data: KnowledgeBaseUpdate, user: dict = Depends(get_current_user)):
    db = get_supabase()
    existing = db.table("knowledge_bases").select("*").eq("id", kb_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    if existing.data["owner_id"] != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can update")

    update_data = data.model_dump(exclude_none=True)
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        db.table("knowledge_bases").update(update_data).eq("id", kb_id).execute()

    updated = db.table("knowledge_bases").select("*").eq("id", kb_id).single().execute()
    return KnowledgeBaseResponse(**updated.data)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(kb_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    existing = db.table("knowledge_bases").select("owner_id").eq("id", kb_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    if existing.data["owner_id"] != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can delete")

    # Cascade delete
    db.table("chunks").delete().eq("knowledge_base_id", kb_id).execute()
    db.table("ingestion_jobs").delete().in_(
        "document_id",
        [d["id"] for d in (db.table("documents").select("id").eq("knowledge_base_id", kb_id).execute().data or [])]
    ).execute()
    db.table("documents").delete().eq("knowledge_base_id", kb_id).execute()
    db.table("conversations").delete().eq("knowledge_base_id", kb_id).execute()
    db.table("permissions").delete().eq("resource_type", "knowledge_base").eq("resource_id", kb_id).execute()
    db.table("knowledge_bases").delete().eq("id", kb_id).execute()
