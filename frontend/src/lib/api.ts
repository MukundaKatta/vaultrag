import type {
  TokenResponse, KnowledgeBase, Document, ChatResponse,
  SearchResponse, ChunkPreviewResponse, IngestionJob, IngestionStats,
  EvalResponse, EmbeddingModelInfo, Permission, Conversation, ChatMessage,
  ChunkingStrategy, SearchMode,
} from './types';

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vaultrag_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export async function register(email: string, password: string, name: string): Promise<TokenResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Knowledge Bases
export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return request('/knowledge-bases');
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase> {
  return request(`/knowledge-bases/${id}`);
}

export async function createKnowledgeBase(data: {
  name: string; description: string; embedding_model: string; embedding_dimension: number;
}): Promise<KnowledgeBase> {
  return request('/knowledge-bases', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateKnowledgeBase(id: string, data: { name?: string; description?: string }): Promise<KnowledgeBase> {
  return request(`/knowledge-bases/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  return request(`/knowledge-bases/${id}`, { method: 'DELETE' });
}

// Documents
export async function listDocuments(knowledgeBaseId: string): Promise<{ documents: Document[]; total: number }> {
  return request(`/documents?knowledge_base_id=${knowledgeBaseId}`);
}

export async function uploadDocument(
  knowledgeBaseId: string, file: File,
  chunkingStrategy: ChunkingStrategy, chunkSize: number, chunkOverlap: number,
): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('knowledge_base_id', knowledgeBaseId);
  formData.append('chunking_strategy', chunkingStrategy);
  formData.append('chunk_size', chunkSize.toString());
  formData.append('chunk_overlap', chunkOverlap.toString());
  return request('/documents', { method: 'POST', body: formData });
}

export async function deleteDocument(id: string): Promise<void> {
  return request(`/documents/${id}`, { method: 'DELETE' });
}

// Chat
export async function sendChatMessage(data: {
  message: string;
  knowledge_base_id: string;
  conversation_id?: string;
  search_mode: SearchMode;
  vector_weight: number;
  top_k: number;
  rewrite_query: boolean;
  model: string;
}): Promise<ChatResponse> {
  return request('/chat', { method: 'POST', body: JSON.stringify(data) });
}

export async function listConversations(knowledgeBaseId?: string): Promise<Conversation[]> {
  const q = knowledgeBaseId ? `?knowledge_base_id=${knowledgeBaseId}` : '';
  return request(`/chat/conversations${q}`);
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  return request(`/chat/conversations/${conversationId}/messages`);
}

export async function deleteConversation(id: string): Promise<void> {
  return request(`/chat/conversations/${id}`, { method: 'DELETE' });
}

// Search
export async function searchKnowledgeBase(data: {
  query: string;
  knowledge_base_id: string;
  mode: SearchMode;
  vector_weight: number;
  top_k: number;
  rewrite: boolean;
}): Promise<SearchResponse> {
  return request('/search', { method: 'POST', body: JSON.stringify(data) });
}

// Chunking Preview
export async function previewChunks(data: {
  text: string;
  config: { strategy: ChunkingStrategy; chunk_size: number; chunk_overlap: number };
}): Promise<ChunkPreviewResponse> {
  return request('/chunking/preview', { method: 'POST', body: JSON.stringify(data) });
}

// Ingestion
export async function listIngestionJobs(knowledgeBaseId?: string): Promise<IngestionJob[]> {
  const q = knowledgeBaseId ? `?knowledge_base_id=${knowledgeBaseId}` : '';
  return request(`/ingestion/jobs${q}`);
}

export async function getIngestionJob(id: string): Promise<IngestionJob> {
  return request(`/ingestion/jobs/${id}`);
}

export async function getIngestionStats(knowledgeBaseId: string): Promise<IngestionStats> {
  return request(`/ingestion/stats/${knowledgeBaseId}`);
}

export async function listEmbeddingModels(): Promise<EmbeddingModelInfo[]> {
  return request('/ingestion/embedding-models');
}

// Evaluation
export async function runEvaluation(data: {
  knowledge_base_id: string;
  queries: { query: string; relevant_chunk_ids: string[] }[];
  k_values: number[];
  search_mode: SearchMode;
  vector_weight: number;
}): Promise<EvalResponse> {
  return request('/evaluation', { method: 'POST', body: JSON.stringify(data) });
}

// Permissions
export async function grantPermission(data: {
  user_id: string;
  resource_type: string;
  resource_id: string;
  permission: string;
}): Promise<Permission> {
  return request('/permissions', { method: 'POST', body: JSON.stringify(data) });
}

export async function listPermissions(resourceType: string, resourceId: string): Promise<Permission[]> {
  return request(`/permissions/${resourceType}/${resourceId}`);
}

export async function revokePermission(id: string): Promise<void> {
  return request(`/permissions/${id}`, { method: 'DELETE' });
}
