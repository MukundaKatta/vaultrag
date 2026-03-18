# VaultRAG

Work-in-progress RAG (Retrieval-Augmented Generation) application. Currently an initial scaffold with backend API structure and minimal frontend.

## What's Here

**Backend (Python/FastAPI):**
- FastAPI app with route stubs for auth, knowledge bases, documents, chat, search, evaluation, and chunking
- Supabase integration (PostgreSQL + pgvector) for data storage
- Dependencies for OpenAI, Cohere, sentence-transformers, and BM25 ranking
- JWT-based auth setup with passlib/python-jose
- Celery + Redis task queue configuration
- Supabase migration SQL file

**Frontend (Next.js/TypeScript):**
- Next.js 14 App Router scaffold with Tailwind CSS
- Login page and dashboard page structure
- Single Sidebar component
- Basic project configuration (tsconfig, postcss, tailwind)

## Tech Stack

- **Backend:** FastAPI, Supabase, OpenAI, Cohere, sentence-transformers, rank-bm25
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Infrastructure:** Celery, Redis

## Status

This is an early-stage scaffold generated with AI assistance. The backend route structure is in place but the frontend is minimal (one component). Not yet functional as a complete application.

## Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Requires Supabase project and API keys configured in .env files. See .env.example files for required variables.
