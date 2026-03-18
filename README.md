# VaultRAG - Enterprise RAG Platform

Tech stack: Next.js 14, TypeScript, Tailwind CSS, Supabase (pgvector), Python FastAPI backend.

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment
Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in values.
