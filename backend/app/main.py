from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import auth, knowledge_bases, documents, chat, search, evaluation, chunking, permissions, ingestion

settings = get_settings()

app = FastAPI(
    title="VaultRAG API",
    description="Enterprise Retrieval-Augmented Generation Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(knowledge_bases.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(chunking.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(ingestion.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vaultrag-api"}
