from __future__ import annotations
import uuid
from datetime import datetime, timezone
import openai
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.search import search_chunks
from app.services.query_rewriter import rewrite_query
from app.services.parsers import get_page_for_offset, get_paragraph_for_offset
from app.models.schemas import ChatRequest, ChatResponse, ChatMessage, Citation


async def handle_chat(request: ChatRequest, user_id: str) -> ChatResponse:
    settings = get_settings()
    db = get_supabase()

    # Get KB info
    kb = db.table("knowledge_bases").select("*").eq("id", request.knowledge_base_id).single().execute()
    if not kb.data:
        raise ValueError("Knowledge base not found")

    kb_data = kb.data
    embedding_model = kb_data["embedding_model"]

    # Optionally rewrite query
    rewritten = None
    search_query = request.message
    if request.rewrite_query:
        rewritten = await rewrite_query(request.message)
        search_query = rewritten

    # Retrieve relevant chunks
    results = await search_chunks(
        query=search_query,
        knowledge_base_id=request.knowledge_base_id,
        embedding_model=embedding_model,
        mode=request.search_mode,
        vector_weight=request.vector_weight,
        top_k=request.top_k,
    )

    # Build citations
    citations: list[Citation] = []
    context_parts: list[str] = []

    for i, chunk in enumerate(results):
        doc_id = chunk.get("document_id", "")
        doc_result = db.table("documents").select("filename,metadata").eq("id", doc_id).single().execute()
        doc_name = doc_result.data["filename"] if doc_result.data else "Unknown"
        doc_meta = doc_result.data.get("metadata", {}) if doc_result.data else {}

        page = None
        paragraph = None
        chunk_offset = chunk.get("start_offset", 0)

        page_map = doc_meta.get("page_map")
        if page_map:
            page = get_page_for_offset(chunk_offset, page_map)

        para_map = doc_meta.get("para_map")
        if para_map:
            paragraph = get_paragraph_for_offset(chunk_offset, para_map)

        citation = Citation(
            document_id=doc_id,
            document_name=doc_name,
            chunk_id=chunk.get("id", ""),
            chunk_text=chunk.get("content", ""),
            page=page,
            paragraph=paragraph,
            relevance_score=chunk.get("score", 0.0),
        )
        citations.append(citation)
        context_parts.append(f"[Source {i + 1}: {doc_name}" +
                           (f", Page {page}" if page else "") +
                           (f", Para {paragraph}" if paragraph else "") +
                           f"]\n{chunk.get('content', '')}")

    context_text = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant documents found."

    # Get conversation history
    conversation_id = request.conversation_id or str(uuid.uuid4())
    history_messages: list[dict] = []

    if request.conversation_id:
        history = db.table("messages").select("*").eq(
            "conversation_id", request.conversation_id
        ).order("created_at").execute()
        for msg in (history.data or []):
            history_messages.append({"role": msg["role"], "content": msg["content"]})

    # Build LLM prompt
    system_prompt = (
        "You are VaultRAG, an enterprise AI assistant. Answer the user's question based on the "
        "provided context. Always cite your sources using [Source N] notation where N matches "
        "the source numbers in the context. If the context doesn't contain enough information "
        "to answer, say so clearly. Be accurate and concise.\n\n"
        f"Context:\n{context_text}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history_messages[-10:])  # Last 10 messages for context
    messages.append({"role": "user", "content": request.message})

    # Call LLM
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=request.model,
        messages=messages,
        temperature=0.2,
        max_tokens=2000,
    )

    assistant_content = response.choices[0].message.content or "I couldn't generate a response."

    # Save messages to conversation
    now = datetime.now(timezone.utc).isoformat()

    # Ensure conversation exists
    db.table("conversations").upsert({
        "id": conversation_id,
        "knowledge_base_id": request.knowledge_base_id,
        "user_id": user_id,
        "title": request.message[:100],
        "updated_at": now,
    }).execute()

    # Save user message
    db.table("messages").insert({
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "role": "user",
        "content": request.message,
        "created_at": now,
    }).execute()

    # Save assistant message
    db.table("messages").insert({
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": assistant_content,
        "citations": [c.model_dump() for c in citations],
        "created_at": now,
    }).execute()

    return ChatResponse(
        conversation_id=conversation_id,
        message=ChatMessage(
            role="assistant",
            content=assistant_content,
            citations=citations,
            timestamp=now,
        ),
        retrieved_chunks=len(results),
        search_mode=request.search_mode,
        rewritten_query=rewritten,
    )
