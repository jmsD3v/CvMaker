# CvMaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multiuser web app that generates ATS-optimized CVs and cover letters (.docx) from a job posting, using the user's full profile stored in Supabase.

**Architecture:** Next.js App Router (Vercel) proxies file uploads to Python FastAPI (Render). FastAPI owns all AI logic: cert extraction via PyMuPDF + Gemini Flash 2.0, CV/letter generation via Gemini, .docx production via python-docx. Supabase handles Auth (HS256 JWT), PostgreSQL, and Storage. Profile CRUD goes directly from Next.js to Supabase.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, pnpm | Python 3.11, FastAPI, PyMuPDF, python-docx, google-generativeai, slowapi | Supabase (Auth + PostgreSQL + Storage) | Gemini Flash 2.0

---

## Repo Structure

```
E:\Dev\CvMaker\
├── frontend/          ← Next.js app
├── backend/           ← FastAPI app
├── seed/              ← One-time data seeder
├── Certificaciones/   ← Existing cert files
└── docs/              ← Specs + plans
```

## File Map

### Frontend (`frontend/`)
| File | Responsibility |
|---|---|
| `middleware.ts` | Protect `/(protected)` routes, redirect to `/login` |
| `lib/supabase.ts` | Browser + server Supabase clients |
| `lib/api.ts` | Typed wrapper for FastAPI calls |
| `types/index.ts` | All shared TypeScript types |
| `app/(auth)/login/page.tsx` | Magic link + email/pass login |
| `app/(protected)/layout.tsx` | Auth check + nav shell |
| `app/(protected)/dashboard/page.tsx` | Stats overview |
| `app/(protected)/profile/contact/page.tsx` | Edit contact info |
| `app/(protected)/profile/experience/page.tsx` | Experience CRUD |
| `app/(protected)/profile/education/page.tsx` | Education CRUD + toggle |
| `app/(protected)/certifications/page.tsx` | Upload + list certs |
| `app/(protected)/generate/page.tsx` | Job posting input + download |
| `app/onboarding/page.tsx` | New user setup wizard |
| `app/api/profile/route.ts` | CRUD contact/experience/education |
| `app/api/certs/upload/route.ts` | Validate + upload to Storage, call FastAPI |
| `app/api/generate/route.ts` | Proxy to FastAPI generate |

### Backend (`backend/`)
| File | Responsibility |
|---|---|
| `main.py` | FastAPI app, CORS, routers |
| `services/auth.py` | Validate Supabase HS256 JWT |
| `services/extractor.py` | PyMuPDF text extract + Gemini Vision fallback |
| `services/generator.py` | Gemini CV generation + python-docx builder |
| `routers/certs.py` | POST /certs/extract |
| `routers/generate.py` | POST /generate |
| `models/schemas.py` | Pydantic models |
| `requirements.txt` | Dependencies |

### Seed (`seed/`)
| File | Responsibility |
|---|---|
| `profile_data.py` | Juanma's static profile data |
| `seed.py` | Insert profile + process Certificaciones folder |

---

## Phase 1 — Project Setup

### Task 1: Initialize Next.js project

**Files:**
- Create: `frontend/` (full Next.js project)

- [ ] **Step 1: Scaffold project**

```powershell
cd E:\Dev\CvMaker
pnpm create next-app@latest frontend --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
cd frontend
pnpm add @supabase/ssr @supabase/supabase-js
pnpm add -D @types/node
```

- [ ] **Step 2: Create `.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
BACKEND_URL=http://localhost:8000
```

- [ ] **Step 3: Create `types/index.ts`**

```typescript
export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  github: string | null
  location: string | null
}

export interface Experience {
  id: string
  user_id: string
  title: string
  company: string
  location: string | null
  start_date: string
  end_date: string | null
  description: string | null
  highlights: string[]
}

export interface Education {
  id: string
  user_id: string
  degree: string
  institution: string
  status: 'in_progress' | 'completed'
  start_year: number
  end_year: number | null
}

export interface Certification {
  id: string
  user_id: string
  name: string
  issuer: string
  issued_date: string | null
  category: 'cybersecurity' | 'ai' | 'dev' | 'industrial' | 'other'
  file_url: string
  file_type: string
  created_at: string
}

export interface GenerateRequest {
  job_posting_text: string
  user_id: string
}

export interface ExtractedCert {
  name: string
  issuer: string
  issued_date: string | null
  category: string
}
```

- [ ] **Step 4: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js frontend"
```

---

### Task 2: Initialize FastAPI project

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/.env.example`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-jose[cryptography]==3.3.0
PyMuPDF==1.24.10
google-generativeai==0.8.3
python-docx==1.1.2
python-multipart==0.0.12
httpx==0.27.2
supabase==2.9.1
slowapi==0.1.9
pydantic==2.9.2
pydantic-settings==2.5.2
python-dotenv==1.0.1
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

- [ ] **Step 2: Create virtual environment and install**

```powershell
cd E:\Dev\CvMaker\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

- [ ] **Step 3: Create `backend/.env.example`**

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000
```

Copy to `.env` and fill in real values.

- [ ] **Step 4: Create `backend/models/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional

class ExtractCertRequest(BaseModel):
    file_url: str
    file_type: str
    user_id: str
    cert_id: str

class ExtractedCert(BaseModel):
    name: str
    issuer: str
    issued_date: Optional[str] = None
    category: str

class GenerateRequest(BaseModel):
    job_posting_text: str
    user_id: str

class Experience(BaseModel):
    title: str
    company: str
    location: Optional[str]
    start_date: str
    end_date: Optional[str]
    description: Optional[str]
    highlights: list[str]

class Education(BaseModel):
    degree: str
    institution: str
    status: str
    start_year: int
    end_year: Optional[int]

class Certification(BaseModel):
    name: str
    issuer: str
    issued_date: Optional[str]
    category: str

class UserProfile(BaseModel):
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    linkedin: Optional[str]
    github: Optional[str]
    location: Optional[str]
    experience: list[Experience]
    education: list[Education]
    certifications: list[Certification]
```

- [ ] **Step 5: Create `backend/main.py`**

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

from routers import certs, generate

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="CvMaker API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(certs.router, prefix="/certs", tags=["certs"])
app.include_router(generate.router, prefix="/generate", tags=["generate"])

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Test health endpoint**

```powershell
uvicorn main:app --reload
```

Open `http://localhost:8000/health` — expect `{"status":"ok"}`.

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize FastAPI backend"
```

---

### Task 3: Supabase Schema + RLS

**Files:**
- Create: `backend/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create `backend/migrations/001_initial_schema.sql`**

```sql
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  linkedin text,
  github text,
  location text
);
alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id);

-- experience
create table public.experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  location text,
  start_date date not null,
  end_date date,
  description text,
  highlights text[] default '{}'
);
alter table public.experience enable row level security;
create policy "Users manage own experience" on public.experience
  for all using (auth.uid() = user_id);

-- education
create table public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  degree text not null,
  institution text not null,
  status text not null default 'in_progress',
  start_year int,
  end_year int
);
alter table public.education enable row level security;
create policy "Users manage own education" on public.education
  for all using (auth.uid() = user_id);

-- certifications
create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  issuer text not null,
  issued_date date,
  category text not null default 'other',
  file_url text,
  file_type text,
  raw_text text,
  created_at timestamp with time zone default now()
);
alter table public.certifications enable row level security;
create policy "Users manage own certifications" on public.certifications
  for all using (auth.uid() = user_id);

-- trigger: create profile row on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Run migration**

Go to Supabase Dashboard → SQL Editor → paste the SQL → Run.

- [ ] **Step 3: Create Storage bucket**

Supabase Dashboard → Storage → New bucket → name: `certifications` → Private (not public).

- [ ] **Step 4: Add Storage RLS policy**

In SQL Editor:

```sql
-- Allow authenticated users to upload to their own folder
create policy "Users upload own certs"
on storage.objects for insert
to authenticated
with check (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read own files
create policy "Users read own certs"
on storage.objects for select
to authenticated
using (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/
git commit -m "feat: add Supabase schema and RLS policies"
```

---

## Phase 2 — Authentication

### Task 4: Next.js Supabase clients + middleware

**Files:**
- Create: `frontend/lib/supabase.ts`
- Create: `frontend/middleware.ts`

- [ ] **Step 1: Create `frontend/lib/supabase.ts`**

```typescript
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 2: Create `frontend/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isProtected = path.startsWith('/dashboard') ||
    path.startsWith('/profile') ||
    path.startsWith('/certifications') ||
    path.startsWith('/generate')

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if ((path === '/login') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/supabase.ts frontend/middleware.ts
git commit -m "feat: add Supabase clients and auth middleware"
```

---

### Task 5: Login page

**Files:**
- Create: `frontend/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create `frontend/app/(auth)/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    })
    if (error) setError(error.message)
    else setStatus('Revisá tu email — te mandamos un link de acceso.')
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">CvMaker</h1>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('magic')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'magic' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >Magic Link</button>
          <button
            onClick={() => setMode('password')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'password' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >Contraseña</button>
        </div>

        <form onSubmit={mode === 'magic' ? handleMagicLink : handlePassword} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {mode === 'password' && (
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {status && <p className="text-green-600 text-sm">{status}</p>}
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            {mode === 'magic' ? 'Enviar link' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify login works**

```powershell
cd frontend && pnpm dev
```

Open `http://localhost:3000/login` — magic link form renders. Try magic link with a real email.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/
git commit -m "feat: add login page with magic link and password"
```

---

### Task 6: FastAPI JWT validation

**Files:**
- Create: `backend/services/auth.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing test — `backend/tests/test_auth.py`**

```python
import pytest
import jwt
import time
import os
from services.auth import validate_token, AuthError

FAKE_SECRET = "testsecret" * 4  # must be ≥32 chars for HS256

def make_token(user_id: str, secret: str, expired: bool = False) -> str:
    exp = time.time() - 10 if expired else time.time() + 3600
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated", "exp": int(exp)},
        secret,
        algorithm="HS256"
    )

def test_valid_token():
    token = make_token("user-123", FAKE_SECRET)
    user_id = validate_token(token, secret=FAKE_SECRET)
    assert user_id == "user-123"

def test_expired_token():
    token = make_token("user-123", FAKE_SECRET, expired=True)
    with pytest.raises(AuthError):
        validate_token(token, secret=FAKE_SECRET)

def test_invalid_signature():
    token = make_token("user-123", "wrongsecret" * 4)
    with pytest.raises(AuthError):
        validate_token(token, secret=FAKE_SECRET)
```

- [ ] **Step 2: Run test — expect FAIL**

```powershell
cd backend && pytest tests/test_auth.py -v
```

Expected: `ModuleNotFoundError: No module named 'services'`

- [ ] **Step 3: Create `backend/services/auth.py`**

```python
import os
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

class AuthError(Exception):
    pass

def validate_token(token: str, secret: str | None = None) -> str:
    secret = secret or os.getenv("SUPABASE_JWT_SECRET", "")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("No subject in token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"Invalid token: {e}")

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    try:
        return validate_token(credentials.credentials)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
```

- [ ] **Step 4: Run test — expect PASS**

```powershell
pytest tests/test_auth.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/services/auth.py backend/tests/
git commit -m "feat: add FastAPI JWT validation with tests"
```

---

## Phase 3 — Profile Management

### Task 7: Contact form + API route

**Files:**
- Create: `frontend/app/api/profile/route.ts`
- Create: `frontend/app/(protected)/layout.tsx`
- Create: `frontend/app/(protected)/profile/contact/page.tsx`

- [ ] **Step 1: Create `frontend/app/(protected)/layout.tsx`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex gap-6 text-sm font-medium">
        <Link href="/dashboard" className="text-gray-700 hover:text-indigo-600">Dashboard</Link>
        <Link href="/profile/contact" className="text-gray-700 hover:text-indigo-600">Perfil</Link>
        <Link href="/certifications" className="text-gray-700 hover:text-indigo-600">Certificaciones</Link>
        <Link href="/generate" className="text-gray-700 hover:text-indigo-600">Generar CV</Link>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/app/api/profile/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['full_name', 'email', 'phone', 'linkedin', 'github', 'location']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create `frontend/app/(protected)/profile/contact/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { Profile } from '@/types'

export default function ContactPage() {
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = (key: keyof Profile, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={(profile[key] as string) || ''}
        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Datos de contacto</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {field('full_name', 'Nombre completo')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Teléfono')}
        {field('linkedin', 'LinkedIn URL')}
        {field('github', 'GitHub URL')}
        {field('location', 'Ubicación')}
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Test manually**

Open `http://localhost:3000/profile/contact` — form loads existing data, edit and save works.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/
git commit -m "feat: add contact form and profile API route"
```

---

### Task 8: Experience CRUD

**Files:**
- Create: `frontend/app/api/profile/experience/route.ts`
- Create: `frontend/app/api/profile/experience/[id]/route.ts`
- Create: `frontend/app/(protected)/profile/experience/page.tsx`

- [ ] **Step 1: Create `frontend/app/api/profile/experience/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('experience')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('experience')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create `frontend/app/api/profile/experience/[id]/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('experience')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('experience')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `frontend/app/(protected)/profile/experience/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { Experience } from '@/types'

const emptyExp = (): Partial<Experience> => ({
  title: '', company: '', location: '', start_date: '', end_date: null, description: '', highlights: []
})

export default function ExperiencePage() {
  const [items, setItems] = useState<Experience[]>([])
  const [editing, setEditing] = useState<Partial<Experience> | null>(null)
  const [isNew, setIsNew] = useState(false)

  async function load() {
    const res = await fetch('/api/profile/experience')
    setItems(await res.json())
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    const method = isNew ? 'POST' : 'PATCH'
    const url = isNew ? '/api/profile/experience' : `/api/profile/experience/${editing.id}`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta experiencia?')) return
    await fetch(`/api/profile/experience/${id}`, { method: 'DELETE' })
    load()
  }

  if (editing) return (
    <div>
      <h1 className="text-xl font-bold mb-6">{isNew ? 'Nueva experiencia' : 'Editar experiencia'}</h1>
      <div className="space-y-4">
        {(['title', 'company', 'location'] as const).map(k => (
          <div key={k}>
            <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{k}</label>
            <input value={(editing[k] as string) || ''} onChange={e => setEditing(p => ({ ...p, [k]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          {(['start_date', 'end_date'] as const).map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{k === 'start_date' ? 'Inicio' : 'Fin (vacío = actual)'}</label>
              <input type="date" value={(editing[k] as string) || ''} onChange={e => setEditing(p => ({ ...p, [k]: e.target.value || null }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
            rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3">
          <button onClick={save} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium">Guardar</button>
          <button onClick={() => setEditing(null)} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium">Cancelar</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Experiencia</h1>
        <button onClick={() => { setEditing(emptyExp()); setIsNew(true) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Agregar</button>
      </div>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-gray-600">{item.company} · {item.location}</p>
                <p className="text-xs text-gray-400">{item.start_date} — {item.end_date ?? 'Actual'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(item); setIsNew(false) }} className="text-sm text-indigo-600">Editar</button>
                <button onClick={() => remove(item.id)} className="text-sm text-red-500">Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test manually**

Open `http://localhost:3000/profile/experience` — add, edit, delete jobs. Verify data persists.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/
git commit -m "feat: add experience CRUD"
```

---

### Task 9: Education CRUD

**Files:**
- Create: `frontend/app/api/profile/education/route.ts`
- Create: `frontend/app/api/profile/education/[id]/route.ts`
- Create: `frontend/app/(protected)/profile/education/page.tsx`

- [ ] **Step 1: Create `frontend/app/api/profile/education/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('education')
    .select('*')
    .eq('user_id', user.id)
    .order('start_year', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('education')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create `frontend/app/api/profile/education/[id]/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('education')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create `frontend/app/(protected)/profile/education/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { Education } from '@/types'

export default function EducationPage() {
  const [items, setItems] = useState<Education[]>([])

  async function load() {
    const res = await fetch('/api/profile/education')
    setItems(await res.json())
  }

  useEffect(() => { load() }, [])

  async function toggleStatus(item: Education) {
    const newStatus = item.status === 'in_progress' ? 'completed' : 'in_progress'
    const updates: Partial<Education> = { status: newStatus }
    if (newStatus === 'completed' && !item.end_year) {
      updates.end_year = new Date().getFullYear()
    }
    await fetch(`/api/profile/education/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Educación</h1>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{item.degree}</p>
              <p className="text-sm text-gray-600">{item.institution}</p>
              <p className="text-xs text-gray-400">{item.start_year}{item.end_year ? ` — ${item.end_year}` : ''}</p>
            </div>
            <button
              onClick={() => toggleStatus(item)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                item.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {item.status === 'completed' ? 'Completado ✓' : 'En curso — marcar completo'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test manually**

Open `http://localhost:3000/profile/education` — toggle status works, updates persist.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/
git commit -m "feat: add education CRUD with status toggle"
```

---

## Phase 4 — Certifications

### Task 10: FastAPI extraction service

**Files:**
- Create: `backend/services/extractor.py`
- Create: `backend/tests/test_extractor.py`

- [ ] **Step 1: Write failing test — `backend/tests/test_extractor.py`**

```python
import pytest
from unittest.mock import patch, MagicMock
from services.extractor import extract_text_from_pdf, parse_cert_with_gemini

def test_extract_text_from_pdf_with_text(tmp_path):
    import fitz
    pdf_path = tmp_path / "test.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Certificate of Completion\nIssued by: TestCorp\nDate: 2025-01-15")
    doc.save(str(pdf_path))
    doc.close()

    text = extract_text_from_pdf(str(pdf_path))
    assert "Certificate" in text
    assert "TestCorp" in text

def test_parse_cert_with_gemini():
    mock_response = MagicMock()
    mock_response.text = '{"name": "Test Cert", "issuer": "TestCorp", "issued_date": "2025-01-15", "category": "cybersecurity"}'

    with patch("services.extractor.model") as mock_model:
        mock_model.generate_content.return_value = mock_response
        result = parse_cert_with_gemini("Certificate of Completion TestCorp 2025-01-15")

    assert result["name"] == "Test Cert"
    assert result["issuer"] == "TestCorp"
    assert result["category"] == "cybersecurity"
```

- [ ] **Step 2: Run test — expect FAIL**

```powershell
pytest tests/test_extractor.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create `backend/services/extractor.py`**

```python
import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai
from pathlib import Path

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-2.0-flash-exp")

EXTRACT_PROMPT = """Analyze this certificate text and extract structured information.
Return ONLY valid JSON with these exact keys:
- name: the certificate/course name (string)
- issuer: the issuing organization (string)
- issued_date: date in YYYY-MM-DD format, or null if not found
- category: one of "cybersecurity", "ai", "dev", "industrial", "other"

Text:
{text}

JSON only, no explanation:"""


def extract_text_from_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def extract_text_from_image_with_gemini(file_path: str) -> str:
    with open(file_path, "rb") as f:
        image_data = f.read()
    ext = Path(file_path).suffix.lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    response = model.generate_content([
        {"mime_type": mime, "data": image_data},
        "Extract all text from this certificate image. Return only the raw text."
    ])
    return response.text.strip()


def parse_cert_with_gemini(text: str) -> dict:
    response = model.generate_content(EXTRACT_PROMPT.format(text=text[:4000]))
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def extract_cert(file_path: str, file_type: str) -> tuple[str, dict]:
    """Returns (raw_text, structured_cert_data)."""
    if file_type == "pdf":
        raw_text = extract_text_from_pdf(file_path)
        if len(raw_text) < 50:
            raw_text = extract_text_from_image_with_gemini(file_path)
    else:
        raw_text = extract_text_from_image_with_gemini(file_path)

    cert_data = parse_cert_with_gemini(raw_text)
    return raw_text, cert_data
```

- [ ] **Step 4: Run test — expect PASS**

```powershell
pytest tests/test_extractor.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/services/extractor.py backend/tests/test_extractor.py
git commit -m "feat: add cert extraction service with PyMuPDF and Gemini"
```

---

### Task 11: FastAPI certs router

**Files:**
- Create: `backend/routers/certs.py`

- [ ] **Step 1: Create `backend/routers/certs.py`**

```python
import os
import tempfile
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client
from models.schemas import ExtractCertRequest, ExtractedCert
from services.extractor import extract_cert
from services.auth import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
)


@router.post("/extract", response_model=ExtractedCert)
@limiter.limit("10/minute")
async def extract_certification(
    request: Request,
    body: ExtractCertRequest,
    user_id: str = Depends(get_current_user)
):
    if user_id != body.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    signed = supabase.storage.from_("certifications").create_signed_url(
        body.file_url, 300
    )
    download_url = signed["signedURL"]

    async with httpx.AsyncClient() as client:
        response = await client.get(download_url)
        response.raise_for_status()
        content = response.content

    ext = body.file_type
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        raw_text, cert_data = extract_cert(tmp_path, ext)
    finally:
        os.unlink(tmp_path)

    supabase.table("certifications").update({
        "name": cert_data.get("name", "Sin nombre"),
        "issuer": cert_data.get("issuer", "Desconocido"),
        "issued_date": cert_data.get("issued_date"),
        "category": cert_data.get("category", "other"),
        "raw_text": raw_text
    }).eq("id", body.cert_id).execute()

    return ExtractedCert(**cert_data)
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/certs.py
git commit -m "feat: add certs extraction router"
```

---

### Task 12: Next.js cert upload + list

**Files:**
- Create: `frontend/app/api/certs/upload/route.ts`
- Create: `frontend/app/api/certs/route.ts`
- Create: `frontend/app/(protected)/certifications/page.tsx`

- [ ] **Step 1: Create `frontend/app/api/certs/upload/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 415 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo muy grande (máx 10MB)' }, { status: 413 })

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
  const fileType = ext === 'jpeg' ? 'jpg' : ext
  const storagePath = `${user.id}/${uuidv4()}.${ext}`

  const buffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('certifications')
    .upload(storagePath, buffer, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: cert, error: insertError } = await supabase
    .from('certifications')
    .insert({ user_id: user.id, file_url: storagePath, file_type: fileType, name: 'Procesando...', issuer: '', category: 'other' })
    .select()
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
  const { data: { session } } = await supabase.auth.getSession()

  fetch(`${backendUrl}/certs/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ file_url: storagePath, file_type: fileType, user_id: user.id, cert_id: cert.id })
  }).catch(console.error) // fire and forget

  return NextResponse.json(cert, { status: 201 })
}
```

- [ ] **Step 2: Install uuid**

```powershell
cd frontend && pnpm add uuid && pnpm add -D @types/uuid
```

- [ ] **Step 3: Create `frontend/app/api/certs/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('certifications')
    .select('id, name, issuer, issued_date, category, file_type, created_at')
    .eq('user_id', user.id)
    .order('issued_date', { ascending: false })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 4: Create `frontend/app/(protected)/certifications/page.tsx`**

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import type { Certification } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  cybersecurity: 'Ciberseguridad',
  ai: 'IA / ML',
  dev: 'Desarrollo',
  industrial: 'Industrial',
  other: 'Otro'
}

export default function CertificationsPage() {
  const [certs, setCerts] = useState<Certification[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch('/api/certs')
    setCerts(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/certs/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
    } else {
      await load()
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Certificaciones</h1>
        <div>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleUpload} className="hidden" id="cert-upload" />
          <label htmlFor="cert-upload" className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            {uploading ? 'Subiendo...' : '+ Subir certificado'}
          </label>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="space-y-3">
        {certs.map(cert => (
          <div key={cert.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{cert.name}</p>
              <p className="text-sm text-gray-600">{cert.issuer}</p>
              <p className="text-xs text-gray-400">{cert.issued_date ?? 'Fecha desconocida'}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">
              {CATEGORY_LABELS[cert.category] ?? cert.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test manually**

Upload a cert PDF — it appears in list as "Procesando..." then after FastAPI extraction refreshes with real data (user may need to reload).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/
git commit -m "feat: add cert upload and list"
```

---

## Phase 5 — CV Generation

### Task 13: FastAPI generation service

**Files:**
- Create: `backend/services/generator.py`
- Create: `backend/tests/test_generator.py`

- [ ] **Step 1: Write failing test — `backend/tests/test_generator.py`**

```python
import pytest
from unittest.mock import patch, MagicMock
from services.generator import build_cv_prompt, build_docx

from models.schemas import UserProfile, Experience, Education, Certification

def make_profile() -> UserProfile:
    return UserProfile(
        full_name="Juan Manuel Silva",
        email="test@test.com",
        phone="3625-455529",
        linkedin="linkedin.com/in/jmsilva83",
        github="github.com/jmsD3v",
        location="Las Breñas, Chaco, Argentina",
        experience=[
            Experience(
                title="Oficial Eléctrico",
                company="MSU Energy",
                location="Chaco",
                start_date="2022-01-01",
                end_date=None,
                description="Parque solar 45MW",
                highlights=["PLC Siemens", "SCADA"]
            )
        ],
        education=[
            Education(degree="Licenciatura en Ciberdefensa", institution="UNDEF", status="in_progress", start_year=2026, end_year=None)
        ],
        certifications=[
            Certification(name="Google Cybersecurity", issuer="Google", issued_date="2025-11-01", category="cybersecurity")
        ]
    )

def test_build_cv_prompt():
    profile = make_profile()
    prompt = build_cv_prompt(profile, "Consultor ciberseguridad industrial OT/IT")
    assert "Juan Manuel Silva" in prompt
    assert "MSU Energy" in prompt
    assert "Google Cybersecurity" in prompt
    assert "ciberseguridad" in prompt.lower()

def test_build_docx_returns_bytes():
    cv_content = {
        "summary": "Profesional con +25 años en infraestructura crítica.",
        "experience": [{"title": "Oficial Eléctrico", "company": "MSU Energy", "period": "2022–Actual", "bullets": ["PLC Siemens", "SCADA"]}],
        "education": [{"degree": "Licenciatura en Ciberdefensa", "institution": "UNDEF", "period": "2026–En curso"}],
        "certifications": [{"name": "Google Cybersecurity", "issuer": "Google", "date": "Nov 2025"}],
        "skills": ["PLC Siemens", "SCADA", "Python"]
    }
    result = build_docx(cv_content, full_name="Juan Manuel Silva", contact="test@test.com | 3625-455529")
    assert isinstance(result, bytes)
    assert len(result) > 1000
```

- [ ] **Step 2: Run test — expect FAIL**

```powershell
pytest tests/test_generator.py -v
```

Expected: `ModuleNotFoundError`

- [ ] **Step 3: Create `backend/services/generator.py`**

```python
import os
import json
import io
import google.generativeai as genai
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from models.schemas import UserProfile

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-2.0-flash-exp")

CV_PROMPT = """You are an expert ATS-optimized CV writer. Generate a tailored CV for this candidate based on the job posting.

CANDIDATE PROFILE:
{profile_json}

JOB POSTING:
{job_posting}

INSTRUCTIONS:
- Rank experience and certifications by relevance to this specific job
- Extract and inject exact keywords from the job posting
- ATS format: no tables, no columns, plain linear text
- Summary: 3-4 sentences highlighting the strongest match points
- Experience bullets: action verb + metric/result format
- Certifications: list only those relevant, most relevant first
- Skills: extract from profile, prioritize what the job mentions

Return ONLY valid JSON with this structure:
{{
  "summary": "...",
  "experience": [
    {{"title": "...", "company": "...", "period": "...", "bullets": ["...", "..."]}}
  ],
  "education": [
    {{"degree": "...", "institution": "...", "period": "..."}}
  ],
  "certifications": [
    {{"name": "...", "issuer": "...", "date": "..."}}
  ],
  "skills": ["...", "..."]
}}"""

LETTER_PROMPT = """Write a professional cover letter in Spanish for this candidate applying to this job.

CANDIDATE: {full_name}
CONTACT: {contact}
CV SUMMARY: {summary}
JOB POSTING: {job_posting}

The letter should:
- Be 3-4 paragraphs
- Mention specific details from the job posting
- Highlight the strongest matches between candidate and role
- End with a clear call to action
- Tone: professional, direct, confident

Return only the letter text, no subject line, no JSON:"""


def build_cv_prompt(profile: UserProfile, job_posting: str) -> str:
    return CV_PROMPT.format(
        profile_json=profile.model_dump_json(indent=2),
        job_posting=job_posting[:3000]
    )


def generate_cv_content(profile: UserProfile, job_posting: str) -> dict:
    prompt = build_cv_prompt(profile, job_posting)
    response = model.generate_content(prompt)
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def generate_cover_letter(profile: UserProfile, job_posting: str, cv_summary: str) -> str:
    contact = f"{profile.email} | {profile.phone}"
    prompt = LETTER_PROMPT.format(
        full_name=profile.full_name,
        contact=contact,
        summary=cv_summary,
        job_posting=job_posting[:2000]
    )
    response = model.generate_content(prompt)
    return response.text.strip()


def _add_heading(doc: Document, text: str, level: int = 1):
    p = doc.add_heading(text, level=level)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.runs[0] if p.runs else p.add_run(text)
    run.font.color.rgb = RGBColor(0x1a, 0x1a, 0x2e)


def build_docx(cv_content: dict, full_name: str, contact: str) -> bytes:
    doc = Document()

    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)

    doc.add_heading(full_name, 0)
    doc.add_paragraph(contact)
    doc.add_paragraph("")

    _add_heading(doc, "RESUMEN PROFESIONAL", 1)
    doc.add_paragraph(cv_content.get("summary", ""))

    _add_heading(doc, "EXPERIENCIA LABORAL", 1)
    for exp in cv_content.get("experience", []):
        p = doc.add_paragraph()
        p.add_run(f"{exp['title']} | {exp['company']}").bold = True
        doc.add_paragraph(exp.get("period", ""))
        for bullet in exp.get("bullets", []):
            doc.add_paragraph(f"• {bullet}")

    _add_heading(doc, "EDUCACIÓN", 1)
    for edu in cv_content.get("education", []):
        p = doc.add_paragraph()
        p.add_run(f"{edu['degree']}").bold = True
        doc.add_paragraph(f"{edu['institution']} | {edu.get('period', '')}")

    _add_heading(doc, "CERTIFICACIONES", 1)
    for cert in cv_content.get("certifications", []):
        doc.add_paragraph(f"• {cert['name']} — {cert['issuer']} ({cert.get('date', '')})")

    _add_heading(doc, "COMPETENCIAS TÉCNICAS", 1)
    skills = cv_content.get("skills", [])
    doc.add_paragraph(" | ".join(skills))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def build_letter_docx(letter_text: str, full_name: str) -> bytes:
    doc = Document()
    doc.add_heading(f"Carta de Presentación — {full_name}", 0)
    for para in letter_text.split("\n\n"):
        doc.add_paragraph(para.strip())
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
pytest tests/test_generator.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/services/generator.py backend/tests/test_generator.py
git commit -m "feat: add CV generation service with Gemini and python-docx"
```

---

### Task 14: FastAPI generate router

**Files:**
- Create: `backend/routers/generate.py`

- [ ] **Step 1: Create `backend/routers/generate.py`**

```python
import os
import zipfile
import io
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client
from models.schemas import GenerateRequest, UserProfile, Experience, Education, Certification
from services.generator import generate_cv_content, generate_cover_letter, build_docx, build_letter_docx
from services.auth import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
)


def fetch_user_profile(user_id: str) -> UserProfile:
    profile_res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    p = profile_res.data

    exp_res = supabase.table("experience").select("*").eq("user_id", user_id).order("start_date", desc=True).execute()
    edu_res = supabase.table("education").select("*").eq("user_id", user_id).order("start_year", desc=True).execute()
    cert_res = supabase.table("certifications").select("name,issuer,issued_date,category").eq("user_id", user_id).order("issued_date", desc=True).execute()

    return UserProfile(
        full_name=p.get("full_name") or "",
        email=p.get("email"),
        phone=p.get("phone"),
        linkedin=p.get("linkedin"),
        github=p.get("github"),
        location=p.get("location"),
        experience=[Experience(**e) for e in (exp_res.data or [])],
        education=[Education(**e) for e in (edu_res.data or [])],
        certifications=[Certification(**c) for c in (cert_res.data or [])]
    )


@router.post("")
@limiter.limit("10/minute")
async def generate_cv(
    request: Request,
    body: GenerateRequest,
    user_id: str = Depends(get_current_user)
):
    if user_id != body.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        profile = fetch_user_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {e}")

    try:
        cv_content = generate_cv_content(profile, body.job_posting_text)
        letter_text = generate_cover_letter(profile, body.job_posting_text, cv_content.get("summary", ""))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating content: {e}")

    contact_parts = [x for x in [profile.email, profile.phone, profile.linkedin, profile.github] if x]
    contact_str = " | ".join(contact_parts)

    cv_bytes = build_docx(cv_content, profile.full_name, contact_str)
    letter_bytes = build_letter_docx(letter_text, profile.full_name)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("CV_JMS.docx", cv_bytes)
        zf.writestr("Carta_Presentacion_JMS.docx", letter_bytes)
    zip_buf.seek(0)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=cvmaker_output.zip"}
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/generate.py
git commit -m "feat: add generate router returning CV + letter as zip"
```

---

### Task 15: Next.js generate page

**Files:**
- Create: `frontend/app/api/generate/route.ts`
- Create: `frontend/app/(protected)/generate/page.tsx`
- Create: `frontend/lib/api.ts`

- [ ] **Step 1: Create `frontend/lib/api.ts`**

```typescript
export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function generateCV(jobPostingText: string, accessToken: string, userId: string): Promise<Blob> {
  const res = await fetch(`${BACKEND_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ job_posting_text: jobPostingText, user_id: userId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(err.detail ?? 'Error generando CV')
  }
  return res.blob()
}
```

- [ ] **Step 2: Create `frontend/app/api/generate/route.ts`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { BACKEND_URL } from '@/lib/api'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  const body = await req.json()

  const res = await fetch(`${BACKEND_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({ job_posting_text: body.job_posting_text, user_id: user.id })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error' }))
    return NextResponse.json({ error: err.detail }, { status: res.status })
  }

  const blob = await res.blob()
  const buffer = Buffer.from(await blob.arrayBuffer())

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=cvmaker_output.zip'
    }
  })
}
```

- [ ] **Step 3: Create `frontend/app/(protected)/generate/page.tsx`**

```typescript
'use client'
import { useRef, useState } from 'react'

export default function GeneratePage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type === 'application/pdf') {
      setError('PDF como aviso: pegá el texto manualmente por ahora. Solo texto plano o imagen funciona para avisos.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setText(reader.result as string)
    reader.readAsText(file)
  }

  async function handleGenerate() {
    if (!text.trim()) { setError('Ingresá el aviso laboral'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_posting_text: text })
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      setLoading(false)
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cvmaker_output.zip'
    a.click()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Generar CV + Carta</h1>
      <p className="text-sm text-gray-600 mb-6">Pegá el aviso laboral o subí un archivo de texto. Vas a recibir un .zip con CV.docx y Carta.docx listos para usar.</p>

      <div className="mb-4">
        <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileLoad} className="hidden" id="posting-file" />
        <label htmlFor="posting-file" className="cursor-pointer text-sm text-indigo-600 hover:underline">
          Cargar desde archivo .txt
        </label>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Pegá el aviso laboral completo acá..."
        rows={14}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Generando CV y carta... (puede tomar 30-60 segundos)' : 'Generar CV + Carta de presentación'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Test end-to-end**

1. Start FastAPI: `uvicorn main:app --reload` in `backend/`
2. Start Next.js: `pnpm dev` in `frontend/`
3. Log in, go to `/generate`, paste a job posting, click generate
4. Verify .zip downloads with both .docx files
5. Open both .docx — verify content is relevant to the job posting

- [ ] **Step 5: Commit**

```bash
git add frontend/app/ frontend/lib/api.ts
git commit -m "feat: add generate page with zip download"
```

---

## Phase 6 — Seed Script

### Task 16: Seed Juanma's profile

**Files:**
- Create: `seed/profile_data.py`
- Create: `seed/seed.py`

- [ ] **Step 1: Create `seed/profile_data.py`**

```python
PROFILE = {
    "full_name": "Juan Manuel Silva",
    "email": "juanmanuelsilva06@gmail.com",
    "phone": "3625-455529",
    "linkedin": "linkedin.com/in/jmsilva83",
    "github": "github.com/jmsD3v",
    "location": "Las Breñas, Chaco, Argentina"
}

EXPERIENCE = [
    {
        "title": "Oficial Eléctrico / Supervisor Integral",
        "company": "MSU Energy — Parque Solar 45 MW",
        "location": "La Corzuela, Gral. Pinedo, Chaco",
        "start_date": "2022-01-01",
        "end_date": None,
        "description": "Participación integral desde terreno virgen hasta puesta en marcha de parque solar de 45 MW sobre ~100 ha. Especialización en BT, MT, PAT y Fibra Óptica. Integración de señales, pruebas y puesta en marcha de PLC Siemens en Estación Transformadora. SCADA y comunicaciones industriales. Inversores Huawei Júpiter 6000 y 9000 (6 bloques).",
        "highlights": ["PLC Siemens", "SCADA", "Inversores Huawei Júpiter 6000/9000", "BT/MT/PAT/Fibra Óptica", "IT/OT", "Infraestructura crítica energética"]
    },
    {
        "title": "Técnico Independiente — Electricidad Industrial y Energías Renovables",
        "company": "Operaciones Propias",
        "location": "Chaco, Argentina",
        "start_date": "2000-01-01",
        "end_date": None,
        "description": "+25 años en electricidad industrial, energías renovables. Instalación Starlink en zonas rurales. CCTV IP (EZVIZ) residencial y comercial.",
        "highlights": ["Electricidad industrial", "Energías renovables", "Starlink", "CCTV IP"]
    },
    {
        "title": "Vendedor / Administrativo",
        "company": "Telecom Personal/Flow + Electro Misiones Neored",
        "location": "Charata, Chaco",
        "start_date": "2020-01-01",
        "end_date": "2023-12-31",
        "description": "Gestión comercial y atención al cliente en telecomunicaciones y electrónica.",
        "highlights": []
    },
    {
        "title": "Gerente de Sucursal",
        "company": "Ghiggeri Motos SRL",
        "location": "Charata, Chaco",
        "start_date": "2018-01-01",
        "end_date": "2018-12-31",
        "description": "Gestión integral de sucursal comercial.",
        "highlights": []
    },
    {
        "title": "Jefe de Sucursal",
        "company": "Correo Argentino",
        "location": "Hermoso Campo, Chaco",
        "start_date": "2011-01-01",
        "end_date": "2012-12-31",
        "description": "Carrera ascendente 2004–2012: distribuidor → Jefe de Sucursal.",
        "highlights": []
    },
]

EDUCATION = [
    {
        "degree": "Licenciatura en Ciberdefensa",
        "institution": "UNDEF / FADENA",
        "status": "in_progress",
        "start_year": 2026,
        "end_year": None
    },
    {
        "degree": "Tecnicatura Superior en Seguridad Informática",
        "institution": "TECLAB",
        "status": "in_progress",
        "start_year": 2024,
        "end_year": None
    },
    {
        "degree": "Certificado Intermedio de Seguridad Informática (Res. 730/MEDGC/25)",
        "institution": "TECLAB",
        "status": "completed",
        "start_year": 2024,
        "end_year": 2025
    },
    {
        "degree": "Carrera Full Stack Developer (JS/React/TS)",
        "institution": "Coderhouse",
        "status": "completed",
        "start_year": 2022,
        "end_year": 2023
    }
]

# Static certs — will be supplemented by auto-extraction from Certificaciones folder
CERTIFICATIONS_STATIC = [
    {"name": "CRTOM — Certified Red Team Operations Management", "issuer": "Red Team Leaders", "issued_date": "2026-01-01", "category": "cybersecurity"},
    {"name": "C-OSIA — Certified OSINT Analyst", "issuer": "Compuweb Academy", "issued_date": "2026-02-01", "category": "cybersecurity"},
    {"name": "CPPS — Certified Phishing Prevention Specialist", "issuer": "Hack & Fix", "issued_date": "2025-12-01", "category": "cybersecurity"},
    {"name": "AI Engineer for Data Scientists Associate", "issuer": "DataCamp", "issued_date": "2025-11-01", "category": "ai"},
    {"name": "Google Cybersecurity Professional Certificate V2", "issuer": "Google / Coursera", "issued_date": "2025-11-01", "category": "cybersecurity"},
    {"name": "Microsoft Cybersecurity Architect (SC-100)", "issuer": "Microsoft", "issued_date": "2025-11-01", "category": "cybersecurity"},
    {"name": "MOOC Ciberseguridad y Ciberdefensa — 315hs", "issuer": "UMA / INCIBE / UE NextGenerationEU", "issued_date": "2025-06-01", "category": "cybersecurity"},
    {"name": "Ciberseguridad Industrial Nivel 1", "issuer": "Ingelearn", "issued_date": "2026-04-01", "category": "cybersecurity"},
    {"name": "Ciberseguridad Industrial Nivel 2", "issuer": "Ingelearn", "issued_date": "2026-04-01", "category": "cybersecurity"},
    {"name": "Linux para Pentesters", "issuer": "Hacker Mentor", "issued_date": "2026-02-01", "category": "cybersecurity"},
    {"name": "Peritaje e Informática Forense", "issuer": "Hacker Mentor", "issued_date": "2026-04-01", "category": "cybersecurity"},
    {"name": "Ciberseguridad y Hacking Ético", "issuer": "BIG school", "issued_date": "2026-04-01", "category": "cybersecurity"},
    {"name": "Risk Reporting to the Board for Modern CISOs", "issuer": "XM Cyber", "issued_date": "2026-01-01", "category": "cybersecurity"},
    {"name": "Introduction to Linux LFS101", "issuer": "Linux Foundation", "issued_date": "2025-10-01", "category": "dev"},
    {"name": "Python Developer", "issuer": "DataCamp", "issued_date": "2026-02-01", "category": "dev"},
    {"name": "Python Nivel II — El camino hacia la Industria 4.0", "issuer": "Ingelearn", "issued_date": "2026-02-01", "category": "industrial"},
    {"name": "Protocolos de comunicaciones y redes en ambientes industriales", "issuer": "Ingelearn", "issued_date": "2026-05-01", "category": "industrial"},
    {"name": "Node-RED para la Industria 4.0", "issuer": "Ingelearn", "issued_date": "2026-05-01", "category": "industrial"},
    {"name": "Virtualización y Docker", "issuer": "Ingelearn", "issued_date": "2026-05-01", "category": "industrial"},
    {"name": "Introducción a Cloud Computing con GCloud", "issuer": "Ingelearn", "issued_date": "2026-04-01", "category": "dev"},
    {"name": "Curso Intensivo de Model Context Protocol", "issuer": "midudev", "issued_date": "2025-08-01", "category": "ai"},
    {"name": "IA Workflows", "issuer": "BIG school", "issued_date": "2025-09-01", "category": "ai"},
]
```

- [ ] **Step 2: Create `seed/seed.py`**

```python
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

from supabase import create_client
from profile_data import PROFILE, EXPERIENCE, EDUCATION, CERTIFICATIONS_STATIC

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
)

def seed(email: str):
    # Find user by email
    users = supabase.auth.admin.list_users()
    user = next((u for u in users if u.email == email), None)
    if not user:
        print(f"User {email} not found. Create account first via the app login.")
        sys.exit(1)

    user_id = user.id
    print(f"Seeding data for {email} (id: {user_id})")

    # Upsert profile
    supabase.table("profiles").upsert({**PROFILE, "id": user_id}).execute()
    print("✓ Profile")

    # Clear and insert experience
    supabase.table("experience").delete().eq("user_id", user_id).execute()
    for exp in EXPERIENCE:
        supabase.table("experience").insert({**exp, "user_id": user_id}).execute()
    print(f"✓ Experience ({len(EXPERIENCE)} items)")

    # Clear and insert education
    supabase.table("education").delete().eq("user_id", user_id).execute()
    for edu in EDUCATION:
        supabase.table("education").insert({**edu, "user_id": user_id}).execute()
    print(f"✓ Education ({len(EDUCATION)} items)")

    # Insert static certifications
    supabase.table("certifications").delete().eq("user_id", user_id).execute()
    for cert in CERTIFICATIONS_STATIC:
        supabase.table("certifications").insert({**cert, "user_id": user_id}).execute()
    print(f"✓ Certifications static ({len(CERTIFICATIONS_STATIC)} items)")

    print("\nSeed complete. You can now upload cert files via the app to add file-backed entries.")

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "juanmanuelsilva06@gmail.com"
    seed(email)
```

- [ ] **Step 3: Run seed**

```powershell
# First: log in to the app once so the user exists in Supabase Auth
# Then:
cd seed
pip install supabase python-dotenv
python seed.py juanmanuelsilva06@gmail.com
```

Expected output:
```
Seeding data for juanmanuelsilva06@gmail.com (id: ...)
✓ Profile
✓ Experience (5 items)
✓ Education (4 items)
✓ Certifications static (22 items)
Seed complete.
```

- [ ] **Step 4: Verify in app**

Open the app, go to `/profile/contact`, `/profile/experience`, `/certifications` — all data visible.

- [ ] **Step 5: Commit**

```bash
git add seed/
git commit -m "feat: add seed script with Juanma's full profile data"
```

---

## Phase 7 — Dashboard + Onboarding

### Task 17: Dashboard

**Files:**
- Create: `frontend/app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Create `frontend/app/(protected)/dashboard/page.tsx`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, expRes, certRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).single(),
    supabase.from('experience').select('id', { count: 'exact' }).eq('user_id', user!.id),
    supabase.from('certifications').select('id', { count: 'exact' }).eq('user_id', user!.id)
  ])

  const name = profileRes.data?.full_name ?? 'Usuario'
  const expCount = expRes.count ?? 0
  const certCount = certRes.count ?? 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Hola, {name.split(' ')[0]}</h1>
      <p className="text-gray-600 mb-8">Tu perfil está listo para generar CVs personalizados.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{expCount}</p>
          <p className="text-sm text-gray-600">Experiencias</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{certCount}</p>
          <p className="text-sm text-gray-600">Certificaciones</p>
        </div>
      </div>

      <Link
        href="/generate"
        className="block w-full bg-indigo-600 text-white text-center py-4 rounded-xl font-semibold hover:bg-indigo-700"
      >
        Generar CV para un aviso →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(protected)/dashboard/
git commit -m "feat: add dashboard with profile stats"
```

---

### Task 18: Onboarding wizard (new users)

**Files:**
- Create: `frontend/app/onboarding/page.tsx`
- Modify: `frontend/middleware.ts`

- [ ] **Step 1: Update middleware to detect new users**

Add to `frontend/middleware.ts` after the auth check, before returning:

```typescript
  // Redirect new users (no profile name) to onboarding
  if (user && isProtected && path !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    if (!profile?.full_name) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }
```

- [ ] **Step 2: Create `frontend/app/onboarding/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [contact, setContact] = useState({ full_name: '', email: '', phone: '', linkedin: '', github: '', location: '' })
  const [saving, setSaving] = useState(false)

  async function saveContact() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    })
    setSaving(false)
    setStep(2)
  }

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center">
          <h2 className="text-xl font-bold mb-4">¡Perfil creado!</h2>
          <p className="text-gray-600 mb-6">Ahora agregá tu experiencia laboral y certificaciones desde el perfil.</p>
          <button onClick={() => router.push('/dashboard')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold">
            Ir al dashboard
          </button>
        </div>
      </div>
    )
  }

  const field = (key: keyof typeof contact, label: string) => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        value={contact[key]}
        onChange={e => setContact(p => ({ ...p, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold mb-2">Bienvenido a CvMaker</h1>
        <p className="text-sm text-gray-600 mb-6">Completá tus datos para empezar a generar CVs.</p>
        <div className="space-y-4">
          {field('full_name', 'Nombre completo *')}
          {field('email', 'Email')}
          {field('phone', 'Teléfono')}
          {field('linkedin', 'LinkedIn URL')}
          {field('github', 'GitHub URL')}
          {field('location', 'Ubicación')}
        </div>
        <button
          onClick={saveContact}
          disabled={saving || !contact.full_name}
          className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Continuar →'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/onboarding/ frontend/middleware.ts
git commit -m "feat: add onboarding wizard for new users"
```

---

## Phase 8 — Deployment

### Task 19: Deploy FastAPI to Render

**Files:**
- Create: `backend/render.yaml`

- [ ] **Step 1: Create `backend/render.yaml`**

```yaml
services:
  - type: web
    name: cvmaker-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: FRONTEND_URL
        sync: false
```

- [ ] **Step 2: Deploy to Render**

1. Push `backend/` to GitHub
2. Go to render.com → New Web Service → connect repo → select `backend/` as root
3. Add all env vars from `.env` in Render dashboard
4. Deploy — note the URL (e.g., `https://cvmaker-api.onrender.com`)

- [ ] **Step 3: Deploy Next.js to Vercel**

1. Push `frontend/` to GitHub
2. Go to vercel.com → New Project → import repo
3. Add env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `BACKEND_URL` = `https://cvmaker-api.onrender.com`
4. Deploy

- [ ] **Step 4: Update CORS in FastAPI**

Set `FRONTEND_URL` in Render to the Vercel production URL (e.g., `https://cvmaker.vercel.app`).

- [ ] **Step 5: Final E2E test**

1. Open production URL
2. Log in with magic link
3. Go to `/certifications` → upload a cert PDF → verify extraction works
4. Go to `/generate` → paste a job posting → verify zip downloads with CV + letter
5. Open both .docx — verify content is relevant

- [ ] **Step 6: Final commit**

```bash
git add backend/render.yaml
git commit -m "feat: add Render deployment config"
```

---

## Self-Review Checklist

- [x] Auth (login, middleware, JWT validation) — Tasks 4, 5, 6
- [x] Profile CRUD (contact, experience, education) — Tasks 7, 8, 9
- [x] Cert upload (validate, store, extract) — Tasks 10, 11, 12
- [x] CV generation (Gemini + python-docx) — Tasks 13, 14, 15
- [x] Cover letter generation — included in Task 13 generator service
- [x] Zip download (CV + letter) — Task 14 generate router
- [x] Multiuser (RLS on all tables) — Task 3
- [x] Rate limiting (10/min on extract + generate) — Tasks 11, 14
- [x] Seed script (Juanma's profile) — Task 16
- [x] Onboarding wizard (new users) — Task 18
- [x] Dashboard — Task 17
- [x] Deployment — Task 19
- [x] Security (MIME validation, max size, private bucket, signed URLs) — Tasks 3, 12
