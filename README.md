# VaultRAG

Enterprise Retrieval-Augmented Generation platform with document ingestion, vector search, chat, and evaluation tools.

## Features

- **Knowledge Bases** -- Create and manage isolated document collections
- **Document Ingestion** -- Upload and process documents with configurable chunking strategies
- **Vector Search** -- Semantic search across knowledge bases with embedding-powered retrieval
- **RAG Chat** -- Conversational AI with grounded answers from your documents
- **Query Rewriting** -- Intelligent query expansion for improved retrieval
- **Chunking Lab** -- Experiment with different text splitting strategies
- **Evaluation Suite** -- Measure retrieval quality and answer accuracy
- **Permission Management** -- Role-based access control for knowledge bases
- **Authentication** -- Secure login with JWT-based auth

## Tech Stack

### Backend
- **Framework:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL + pgvector)
- **Embeddings:** OpenAI / custom embedding models
- **Search:** Vector similarity search with pgvector

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **File Upload:** React Dropzone
- **Markdown:** React Markdown
- **State Management:** Zustand
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Backend `.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
FRONTEND_URL=http://localhost:3000
```

Frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
vaultrag/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # FastAPI route handlers
│   │   ├── core/             # Config, database, auth
│   │   ├── models/           # Pydantic schemas
│   │   └── services/         # Business logic
│   └── main.py               # FastAPI entry point
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   └── dashboard/    # Main application views
│   │   ├── components/       # React components
│   │   └── lib/              # API client, store, types
│   └── package.json
└── README.md
```

## License

MIT
