-- VaultRAG Database Schema for Supabase (PostgreSQL + pgvector)

-- Enable pgvector extension
create extension if not exists vector;

-- Users
create table if not exists users (
    id uuid primary key,
    email text unique not null,
    name text not null,
    password_hash text not null,
    role text not null default 'user',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_users_email on users(email);

-- Knowledge Bases
create table if not exists knowledge_bases (
    id uuid primary key,
    name text not null,
    description text default '',
    embedding_model text not null default 'openai',
    embedding_dimension int not null default 1536,
    owner_id uuid not null references users(id) on delete cascade,
    document_count int default 0,
    chunk_count int default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_kb_owner on knowledge_bases(owner_id);

-- Documents
create table if not exists documents (
    id uuid primary key,
    knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade,
    filename text not null,
    file_type text not null,
    file_size bigint not null default 0,
    status text not null default 'processing',
    chunk_count int default 0,
    error_message text,
    metadata jsonb default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_docs_kb on documents(knowledge_base_id);
create index idx_docs_status on documents(status);

-- Chunks (with vector embedding)
create table if not exists chunks (
    id uuid primary key,
    document_id uuid not null references documents(id) on delete cascade,
    knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade,
    content text not null,
    embedding vector(3072),  -- max dimension, actual size varies by model
    chunk_index int not null default 0,
    start_offset int default 0,
    token_count int default 0,
    metadata jsonb default '{}',
    created_at timestamptz not null default now()
);

create index idx_chunks_doc on chunks(document_id);
create index idx_chunks_kb on chunks(knowledge_base_id);

-- Create HNSW index for fast vector search (for 1536-dim OpenAI embeddings)
-- Note: for different dimensions, you may need additional indexes
create index idx_chunks_embedding on chunks using hnsw (embedding vector_cosine_ops);

-- Conversations
create table if not exists conversations (
    id uuid primary key,
    knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    title text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_conv_user on conversations(user_id);
create index idx_conv_kb on conversations(knowledge_base_id);

-- Messages
create table if not exists messages (
    id uuid primary key,
    conversation_id uuid not null references conversations(id) on delete cascade,
    role text not null,
    content text not null,
    citations jsonb default '[]',
    created_at timestamptz not null default now()
);

create index idx_msg_conv on messages(conversation_id);

-- Permissions
create table if not exists permissions (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    resource_type text not null,
    resource_id uuid not null,
    permission text not null default 'read',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_perm_user on permissions(user_id);
create index idx_perm_resource on permissions(resource_type, resource_id);

-- Ingestion Jobs
create table if not exists ingestion_jobs (
    id uuid primary key,
    document_id uuid not null references documents(id) on delete cascade,
    status text not null default 'pending',
    progress float default 0.0,
    chunk_count int default 0,
    error_message text,
    estimated_cost float default 0.0,
    started_at timestamptz,
    completed_at timestamptz
);

create index idx_jobs_doc on ingestion_jobs(document_id);
create index idx_jobs_status on ingestion_jobs(status);

-- RPC function for vector similarity search
create or replace function match_chunks(
    query_embedding vector(3072),
    match_count int default 10,
    kb_id uuid default null
)
returns table (
    id uuid,
    document_id uuid,
    knowledge_base_id uuid,
    content text,
    chunk_index int,
    start_offset int,
    token_count int,
    metadata jsonb,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        c.id,
        c.document_id,
        c.knowledge_base_id,
        c.content,
        c.chunk_index,
        c.start_offset,
        c.token_count,
        c.metadata,
        1 - (c.embedding <=> query_embedding) as similarity
    from chunks c
    where (kb_id is null or c.knowledge_base_id = kb_id)
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;
