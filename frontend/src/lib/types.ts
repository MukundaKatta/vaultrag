export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  embedding_dimension: number;
  owner_id: string;
  document_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  knowledge_base_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  chunk_count: number;
  error_message?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  document_id: string;
  document_name: string;
  chunk_id: string;
  chunk_text: string;
  page?: number;
  paragraph?: number;
  relevance_score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  timestamp?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: ChatMessage;
  retrieved_chunks: number;
  search_mode: string;
  rewritten_query?: string;
}

export interface Conversation {
  id: string;
  knowledge_base_id: string;
  user_id: string;
  title: string;
  updated_at: string;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_name: string;
  text: string;
  score: number;
  page?: number;
  paragraph?: number;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  rewritten_query?: string;
  mode: string;
}

export interface ChunkPreview {
  index: number;
  text: string;
  token_count: number;
  char_count: number;
}

export interface ChunkPreviewResponse {
  chunks: ChunkPreview[];
  total_chunks: number;
  avg_tokens: number;
}

export interface IngestionJob {
  id: string;
  document_id: string;
  filename: string;
  status: string;
  progress: number;
  chunk_count: number;
  error_message?: string;
  estimated_cost?: number;
  started_at?: string;
  completed_at?: string;
}

export interface IngestionStats {
  total_documents: number;
  total_chunks: number;
  documents_processing: number;
  documents_completed: number;
  documents_failed: number;
  estimated_total_cost: number;
}

export interface EvalMetric {
  k: number;
  precision: number;
  recall: number;
  mrr: number;
}

export interface EvalResult {
  query: string;
  metrics: EvalMetric[];
}

export interface EvalResponse {
  results: EvalResult[];
  aggregate: EvalMetric[];
}

export interface EmbeddingModelInfo {
  id: string;
  name: string;
  provider: string;
  dimension: number;
  max_tokens: number;
  cost_per_1k_tokens: number;
  description: string;
}

export interface Permission {
  id: string;
  user_id: string;
  user_email: string;
  resource_type: string;
  resource_id: string;
  permission: string;
  created_at: string;
}

export type ChunkingStrategy = 'fixed' | 'semantic' | 'recursive' | 'sentence';
export type SearchMode = 'hybrid' | 'vector' | 'keyword';
