from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.chat import handle_chat
from app.models.schemas import ChatRequest, ChatResponse, ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        return await handle_chat(request, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/conversations")
async def list_conversations(
    knowledge_base_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_supabase()
    query = db.table("conversations").select("*").eq("user_id", user["id"])
    if knowledge_base_id:
        query = query.eq("knowledge_base_id", knowledge_base_id)
    result = query.order("updated_at", desc=True).execute()
    return result.data or []


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    # Verify ownership
    conv = db.table("conversations").select("user_id").eq("id", conversation_id).single().execute()
    if not conv.data or conv.data["user_id"] != user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    messages = db.table("messages").select("*").eq(
        "conversation_id", conversation_id
    ).order("created_at").execute()
    return messages.data or []


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    conv = db.table("conversations").select("user_id").eq("id", conversation_id).single().execute()
    if not conv.data or conv.data["user_id"] != user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    db.table("messages").delete().eq("conversation_id", conversation_id).execute()
    db.table("conversations").delete().eq("id", conversation_id).execute()
