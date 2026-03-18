from __future__ import annotations
import uuid
from datetime import datetime, timezone
from app.core.database import get_supabase
from app.services.parsers import parse_document
from app.services.chunking import chunk_text, count_tokens, ChunkingConfig
from app.services.embeddings import embed_texts, estimate_embedding_cost


async def ingest_document(
    document_id: str,
    knowledge_base_id: str,
    filename: str,
    content: bytes,
    chunking_config: ChunkingConfig,
    embedding_model: str,
) -> dict:
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Create ingestion job
    job_id = str(uuid.uuid4())
    db.table("ingestion_jobs").insert({
        "id": job_id,
        "document_id": document_id,
        "status": "processing",
        "progress": 0.0,
        "chunk_count": 0,
        "started_at": now,
    }).execute()

    try:
        # Parse document
        _update_job(db, job_id, progress=0.1, status="parsing")
        full_text, metadata = parse_document(filename, content)

        if not full_text.strip():
            _update_job(db, job_id, progress=1.0, status="failed", error="No text content extracted")
            _update_doc_status(db, document_id, "failed", error="No text content extracted")
            return {"status": "failed", "error": "No text content extracted"}

        # Update document metadata
        db.table("documents").update({
            "metadata": metadata,
            "updated_at": now,
        }).eq("id", document_id).execute()

        # Chunk text
        _update_job(db, job_id, progress=0.3, status="chunking")
        chunks = chunk_text(full_text, chunking_config)

        if not chunks:
            _update_job(db, job_id, progress=1.0, status="failed", error="No chunks generated")
            _update_doc_status(db, document_id, "failed", error="No chunks generated")
            return {"status": "failed", "error": "No chunks generated"}

        # Estimate cost
        avg_tokens = sum(count_tokens(c) for c in chunks) / len(chunks)
        estimated_cost = estimate_embedding_cost(len(chunks), int(avg_tokens), embedding_model)
        _update_job(db, job_id, progress=0.4, estimated_cost=estimated_cost)

        # Embed chunks in batches
        _update_job(db, job_id, progress=0.5, status="embedding")
        batch_size = 50
        all_embeddings: list[list[float]] = []

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            embeddings = await embed_texts(batch, model_id=embedding_model)
            all_embeddings.extend(embeddings)
            progress = 0.5 + (0.4 * (i + len(batch)) / len(chunks))
            _update_job(db, job_id, progress=min(progress, 0.9))

        # Store chunks
        _update_job(db, job_id, progress=0.9, status="storing")
        offset = 0
        chunk_records = []
        for i, (chunk_text_content, embedding) in enumerate(zip(chunks, all_embeddings)):
            chunk_id = str(uuid.uuid4())
            chunk_records.append({
                "id": chunk_id,
                "document_id": document_id,
                "knowledge_base_id": knowledge_base_id,
                "content": chunk_text_content,
                "embedding": embedding,
                "chunk_index": i,
                "start_offset": offset,
                "token_count": count_tokens(chunk_text_content),
                "metadata": {},
                "created_at": now,
            })
            offset += len(chunk_text_content)

        # Insert in batches
        for i in range(0, len(chunk_records), 100):
            batch = chunk_records[i:i + 100]
            db.table("chunks").insert(batch).execute()

        # Finalize
        completed_at = datetime.now(timezone.utc).isoformat()
        _update_job(db, job_id, progress=1.0, status="completed",
                    chunk_count=len(chunks), completed_at=completed_at,
                    estimated_cost=estimated_cost)
        _update_doc_status(db, document_id, "ready", chunk_count=len(chunks))

        # Update KB counts
        _update_kb_counts(db, knowledge_base_id)

        return {
            "status": "completed",
            "job_id": job_id,
            "chunk_count": len(chunks),
            "estimated_cost": estimated_cost,
        }

    except Exception as e:
        error_msg = str(e)
        _update_job(db, job_id, progress=1.0, status="failed", error=error_msg)
        _update_doc_status(db, document_id, "failed", error=error_msg)
        return {"status": "failed", "error": error_msg}


def _update_job(db, job_id: str, **kwargs):
    update_data = {}
    if "progress" in kwargs:
        update_data["progress"] = kwargs["progress"]
    if "status" in kwargs:
        update_data["status"] = kwargs["status"]
    if "error" in kwargs:
        update_data["error_message"] = kwargs["error"]
    if "chunk_count" in kwargs:
        update_data["chunk_count"] = kwargs["chunk_count"]
    if "estimated_cost" in kwargs:
        update_data["estimated_cost"] = kwargs["estimated_cost"]
    if "completed_at" in kwargs:
        update_data["completed_at"] = kwargs["completed_at"]
    if update_data:
        db.table("ingestion_jobs").update(update_data).eq("id", job_id).execute()


def _update_doc_status(db, document_id: str, status: str, chunk_count: int = 0, error: str = ""):
    now = datetime.now(timezone.utc).isoformat()
    update = {"status": status, "updated_at": now}
    if chunk_count:
        update["chunk_count"] = chunk_count
    if error:
        update["error_message"] = error
    db.table("documents").update(update).eq("id", document_id).execute()


def _update_kb_counts(db, knowledge_base_id: str):
    docs = db.table("documents").select("id", count="exact").eq(
        "knowledge_base_id", knowledge_base_id
    ).eq("status", "ready").execute()
    chunks = db.table("chunks").select("id", count="exact").eq(
        "knowledge_base_id", knowledge_base_id
    ).execute()

    now = datetime.now(timezone.utc).isoformat()
    db.table("knowledge_bases").update({
        "document_count": docs.count or 0,
        "chunk_count": chunks.count or 0,
        "updated_at": now,
    }).eq("id", knowledge_base_id).execute()
