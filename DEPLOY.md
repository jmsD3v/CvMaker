# Deploy Guide

## Prerequisites
- Supabase project created (free tier)
- Gemini API key (free tier, aistudio.google.com)
- Render account (free tier)
- Vercel account (free tier)

## 1. Supabase Setup

### Run migrations (in order)
Paste each file into Supabase SQL Editor and execute:
1. `backend/migrations/001_initial_schema.sql`
2. `backend/migrations/002_storage_rls.sql`

### Create Storage bucket
SQL Editor:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('certifications', 'certifications', false);
```

### Get credentials
- Project URL: Settings → API → Project URL
- Anon key: Settings → API → `anon` `public`
- Service role key: Settings → API → `service_role` `secret`
- JWT secret: Settings → API → JWT Settings → JWT Secret

## 2. Backend — Render

1. Push code to GitHub
2. New Web Service → connect repo
3. Root directory: `backend`
4. Runtime: Python 3, Build: `pip install -r requirements.txt`, Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set environment variables:
   - `SUPABASE_URL` — Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `GEMINI_API_KEY`
   - `FRONTEND_URL` — Vercel URL (update after frontend deploy)
6. Deploy → copy the service URL (e.g. `https://cvmaker-backend.onrender.com`)

## 3. Frontend — Vercel

1. New Project → connect repo
2. Root directory: `frontend`
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `BACKEND_URL` — Render URL from step 2
4. Deploy

### After deploy
- Go back to Render → update `FRONTEND_URL` to Vercel URL
- Go to Supabase → Auth → URL Configuration → add Vercel URL to allowed redirect URLs

## 4. Seed Juanma's data

After first login to the app:
```bash
cd seed
pip install supabase python-dotenv
python seed.py juanmanuelsilva06@gmail.com
```

Make sure `backend/.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Local Development

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env        # fill in values
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # fill in values
pnpm dev
```
