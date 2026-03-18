from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


# ── Auth ──

class UserCreate(BaseModel):
    email: str
    password: str
    name: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Knowledge Base ──

class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str = ""
    embedding_model: Literal["openai", "cohere", "local"] = "openai"
    embedding_dimension: int = 1536


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    description: str
    embedding_model: str
    embedding_dimension: int
    owner_id: str
    document_count: int = 0
    chunk_count: int = 0
    created_at: str
    updated_at: str


# ── Documents ──

class DocumentResponse(BaseModel):
    id: str
    knowledge_base_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    error_message: Optional[str] = None
    metadata: dict = {}
    created_at: str
    updated_at: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


# ── Chunking ──

ChunkingStrategy = Literal["fixed", "semantic", "recursive", "sentence"]


class ChunkingConfig(BaseModel):
    strategy: ChunkingStrategy = "recursive"
    chunk_size: int = 512
    chunk_overlap: int = 50
    separator: Optional[str] = None


class ChunkPreviewRequest(BaseModel):
    text: str
    config: ChunkingConfig


class ChunkPreview(BaseModel):
    index: int
    text: str
    token_count: int
    char_count: int


class ChunkPreviewResponse(BaseModel):
    chunks: list[ChunkPreview]
    total_chunks: int
    avg_tokens: float


# ── Chat ──

class Citation(BaseModel):
    document_id: str
    document_name: str
    chunk_id: str
    chunk_text: str
    page: Optional[int] = None
    paragraph: Optional[int] = None
    relevance_score: float


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    citations: list[Citation] = []
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    knowledge_base_id: str
    conversation_id: Optional[str] = None
    search_mode: Literal["hybrid", "vector", "keyword"] = "hybrid"
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0)
    top_k: int = Field(default=5, ge=1, le=20)
    rewrite_query: bool = True
    model: str = "gpt-4o"


class ChatResponse(BaseModel):
    conversation_id: str
    message: ChatMessage
    retrieved_chunks: int
    search_mode: str
    rewritten_query: Optional[str] = None


# ── Search ──

class SearchRequest(BaseModel):
    query: str
    knowledge_base_id: str
    mode: Literal["hybrid", "vector", "keyword"] = "hybrid"
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0)
    top_k: int = Field(default=10, ge=1, le=50)
    rewrite: bool = False


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    text: str
    score: float
    page: Optional[int] = None
    paragraph: Optional[int] = None
    metadata: dict = {}


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    rewritten_query: Optional[str] = None
    mode: str


# ── Evaluation ──

class EvalQuery(BaseModel):
    query: str
    relevant_chunk_ids: list[str]


class EvalRequest(BaseModel):
    knowledge_base_id: str
    queries: list[EvalQuery]
    k_values: list[int] = [1, 3, 5, 10]
    search_mode: Literal["hybrid", "vector", "keyword"] = "hybrid"
    vector_weight: float = 0.7


class EvalMetric(BaseModel):
    k: int
    precision: float
    recall: float
    mrr: float


class EvalResult(BaseModel):
    query: str
    metrics: list[EvalMetric]


class EvalResponse(BaseModel):
    results: list[EvalResult]
    aggregate: list[EvalMetric]


# ── Permissions ──

class PermissionGrant(BaseModel):
    user_id: str
    resource_type: Literal["knowledge_base", "document"]
    resource_id: str
    permission: Literal["read", "write", "admin"]


class PermissionResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    resource_type: str
    resource_id: str
    permission: str
    created_at: str


# ── Ingestion Monitoring ──

class IngestionJob(BaseModel):
    id: str
    document_id: str
    filename: str
    status: str
    progress: float
    chunk_count: int
    error_message: Optional[str] = None
    estimated_cost: Optional[float] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class IngestionStats(BaseModel):
    total_documents: int
    total_chunks: int
    documents_processing: int
    documents_completed: int
    documents_failed: int
    estimated_total_cost: float


# ── Embedding Model ──

class EmbeddingModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    dimension: int
    max_tokens: int
    cost_per_1k_tokens: float
    description: str
