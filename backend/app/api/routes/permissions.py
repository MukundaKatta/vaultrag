from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.models.schemas import PermissionGrant, PermissionResponse

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.post("", response_model=PermissionResponse)
async def grant_permission(data: PermissionGrant, user: dict = Depends(get_current_user)):
    db = get_supabase()

    # Verify the granter owns the resource
    if data.resource_type == "knowledge_base":
        resource = db.table("knowledge_bases").select("owner_id").eq("id", data.resource_id).single().execute()
    else:
        doc = db.table("documents").select("knowledge_base_id").eq("id", data.resource_id).single().execute()
        if not doc.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        resource = db.table("knowledge_bases").select("owner_id").eq(
            "id", doc.data["knowledge_base_id"]
        ).single().execute()

    if not resource.data or resource.data["owner_id"] != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only resource owner can grant permissions")

    # Verify target user exists
    target = db.table("users").select("id,email").eq("id", data.user_id).single().execute()
    if not target.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")

    # Check for existing permission
    existing = db.table("permissions").select("id").eq("user_id", data.user_id).eq(
        "resource_type", data.resource_type
    ).eq("resource_id", data.resource_id).execute()

    now = datetime.now(timezone.utc).isoformat()

    if existing.data:
        # Update
        db.table("permissions").update({
            "permission": data.permission,
            "updated_at": now,
        }).eq("id", existing.data[0]["id"]).execute()
        perm_id = existing.data[0]["id"]
    else:
        perm_id = str(uuid.uuid4())
        db.table("permissions").insert({
            "id": perm_id,
            "user_id": data.user_id,
            "resource_type": data.resource_type,
            "resource_id": data.resource_id,
            "permission": data.permission,
            "created_at": now,
            "updated_at": now,
        }).execute()

    return PermissionResponse(
        id=perm_id,
        user_id=data.user_id,
        user_email=target.data["email"],
        resource_type=data.resource_type,
        resource_id=data.resource_id,
        permission=data.permission,
        created_at=now,
    )


@router.get("/{resource_type}/{resource_id}", response_model=list[PermissionResponse])
async def list_permissions(resource_type: str, resource_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("permissions").select("*").eq(
        "resource_type", resource_type
    ).eq("resource_id", resource_id).execute()

    responses = []
    for p in (result.data or []):
        target = db.table("users").select("email").eq("id", p["user_id"]).single().execute()
        email = target.data["email"] if target.data else "unknown"
        responses.append(PermissionResponse(
            id=p["id"], user_id=p["user_id"], user_email=email,
            resource_type=p["resource_type"], resource_id=p["resource_id"],
            permission=p["permission"], created_at=p["created_at"],
        ))
    return responses


@router.delete("/{perm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_permission(perm_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    perm = db.table("permissions").select("*").eq("id", perm_id).single().execute()
    if not perm.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    db.table("permissions").delete().eq("id", perm_id).execute()
