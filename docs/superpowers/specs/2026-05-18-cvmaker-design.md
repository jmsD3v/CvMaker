# CvMaker — Design Spec
**Date:** 2026-05-18  
**Status:** Approved  
**Author:** Juan Manuel Silva (Juanma)

---

## Overview

Web app that generates ATS-optimized CVs and cover letters tailored to a specific job posting. The user uploads a job posting (text or file), the app reads the user's full profile (experience, education, certifications) from the database, and uses Gemini Flash to generate a .docx CV and .docx cover letter for download.

Certifications are uploaded as files (PDF/PNG/JPG/JPEG); AI extracts structured data automatically and updates the profile. No manual cert entry required.

Multiuser. Each user manages their own profile independently.

---

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js App Router (TypeScript, Tailwind CSS) | Vercel free tier |
| Backend | Python FastAPI | Render free tier |
| Database | Supabase PostgreSQL | Supabase free tier |
| Storage | Supabase Storage | Supabase free tier |
| Auth | Supabase Auth (magic link + email+pass, both enabled) | Supabase free tier |
| AI | Google Gemini Flash 2.0 | Free tier (1M tokens/day, 15 RPM) |
| PDF text extraction | PyMuPDF | Python library (free) |
| .docx generation | python-docx | Python library (free) |
| Package manager | pnpm | — |

**Cost target: $0** under normal personal/small-group usage.

---

## Architecture

```
[Next.js / Vercel]  ←→  [FastAPI / Render]  ←→  [Gemini Flash API]
       ↕                        ↕
  [Supabase Auth]        [Supabase Storage + PostgreSQL]
```

- Next.js handles UI, auth middleware, and proxies file uploads to FastAPI.
- FastAPI owns all AI logic: cert extraction, job posting analysis, CV/cover letter generation, .docx production.
- Supabase Auth issues JWTs validated by both Next.js middleware and FastAPI (JWKS endpoint — no extra DB call per request).
- Profile CRUD (contact, experience, education) goes directly from Next.js to Supabase (no FastAPI hop needed).
- Generated .docx files are streamed directly to the user — never stored.

---

## Data Model

```sql
-- auth.users managed by Supabase Auth

profiles
  id          uuid PK  (= auth.users.id)
  full_name   text
  email       text
  phone       text
  linkedin    text
  github      text
  location    text

experience                     -- one row per job
  id          uuid PK
  user_id     uuid FK → profiles
  title       text
  company     text
  location    text
  start_date  date
  end_date    date             -- null = current position
  description text
  highlights  text[]
  -- sorted by start_date DESC in queries, no manual sort_order needed

education
  id          uuid PK
  user_id     uuid FK → profiles
  degree      text
  institution text
  status      text             -- 'in_progress' | 'completed'
  start_year  int
  end_year    int              -- null if in_progress

certifications
  id            uuid PK
  user_id       uuid FK → profiles
  name          text           -- AI-extracted
  issuer        text           -- AI-extracted
  issued_date   date           -- AI-extracted
  category      text           -- 'cybersecurity' | 'ai' | 'dev' | 'industrial' | 'other'
  file_url      text           -- Supabase Storage path
  file_type     text           -- 'pdf' | 'png' | 'jpg' | 'jpeg'
  raw_text      text           -- extracted text (not exposed to frontend)
  created_at    timestamp
```

**RLS:** all tables enforce `user_id = auth.uid()`. Cross-user data access blocked at DB level regardless of application bugs.

---

## Core Flows

### Flow 1 — Upload Certification

```
User uploads file (PDF/PNG/JPG/JPEG)
→ Next.js POST /api/certs/upload
  → validate MIME type + size (≤10MB)
  → upload to Supabase Storage as {user_id}/{uuid}.{ext}
  → call FastAPI POST /certs/extract with Storage URL + file_type
    → if PDF with text: PyMuPDF extracts text (no AI)
    → if image or scanned PDF: Gemini Flash Vision extracts text
    → Gemini extracts structured fields: name, issuer, issued_date, category
  → INSERT into certifications table
→ Frontend displays cert in list with extracted fields
```

### Flow 2 — Generate CV + Cover Letter

```
User pastes job posting text OR uploads file
→ FastAPI POST /generate
  → if file: extract text (same pipeline as certs)
  → Gemini analyzes job posting: keywords, requirements, tech stack, role type
  → FastAPI reads full user profile from Supabase:
      profile + experience + education + certifications
  → Gemini generates ATS-optimized CV content (structured JSON):
      - ranks/filters certs and experience by relevance to posting
      - injects exact keywords from job posting
      - formats for ATS: no tables, no columns, linear text
  → Gemini generates cover letter content
  → python-docx builds CV.docx + CoverLetter.docx
  → FastAPI returns both files as multipart response
→ Next.js triggers two browser downloads
```

### Flow 0 — Initial Data Seed (first user / Juanma)

```
One-time seed script (Python):
→ Reads profile data from briefing (contact, experience, education)
→ Reads all files in /Certificaciones folder
→ Runs each cert file through the same extraction pipeline (PyMuPDF + Gemini)
→ Inserts everything into Supabase under Juanma's user_id
→ Run once after first deploy: python seed.py
```

For subsequent new users who register independently:
```
New user completes registration
→ Middleware detects profile.full_name is null
→ Redirect to /onboarding wizard (3 steps):
    1. Contact info
    2. Experience (at least one job — skippable)
    3. Education (skippable)
→ On complete: redirect to /dashboard
```

### Flow 3 — Profile Management

```
User edits contact / experience / education in forms
→ Next.js API route
→ Supabase CRUD directly (no FastAPI)
```

---

## Pages

```
/login                    magic link or email+pass
/dashboard                overview: cert count, quick access to generate
/profile
  /profile/contact        edit contact info
  /profile/experience     list/add/edit/delete jobs, reorder
  /profile/education      list degrees, toggle status to 'completed'
/certifications           list uploaded certs, upload new file
/generate                 paste text or upload job posting → download CV + letter
```

---

## Project Structure

### Next.js

```
/app
  /(auth)/login/
  /(protected)/
    /dashboard/
    /profile/contact/
    /profile/experience/
    /profile/education/
    /certifications/
    /generate/
/app/api
  /certs/upload/route.ts
  /profile/route.ts
  /generate/route.ts        (proxies to FastAPI)
/components/
/types/
/lib/
  supabase.ts
  api.ts                    (FastAPI wrapper)
```

### FastAPI

```
main.py
/routers
  certs.py
  generate.py
/services
  extractor.py              (PyMuPDF + Gemini Vision)
  generator.py              (Gemini text + python-docx)
  auth.py                   (Supabase JWT validation)
/models
  schemas.py
```

---

## Security

### Authentication & Authorization
- Supabase Auth issues RS256 JWTs. All FastAPI requests require `Authorization: Bearer <jwt>` header.
- FastAPI validates JWT via Supabase JWKS endpoint — no extra DB call per request.
- RLS on all tables: `user_id = auth.uid()` blocks cross-user access at DB level.

### File Uploads
- MIME type whitelist enforced in Next.js API route: `application/pdf`, `image/png`, `image/jpeg` only.
- Max file size: 10MB.
- Storage bucket is private. Frontend accesses files via signed URLs with 15-minute TTL.
- Files stored as `{user_id}/{uuid}.{ext}` — original filename never used (prevents path traversal).

### FastAPI
- CORS restricted to production Next.js domain only (no wildcard).
- `GEMINI_API_KEY` never exposed to frontend or logs — server-side only.
- All secrets (`GEMINI_API_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) in Render environment variables.
- Rate limiting on `/generate` and `/certs/extract`: 10 requests/minute per user (protects Gemini free tier quota).

### Next.js
- Middleware verifies session on all `/(protected)` routes — redirects to `/login` if expired.
- No `NEXT_PUBLIC_` prefix on sensitive vars. Only Supabase URL and anon key exposed to client.

### Data
- `raw_text` field never returned to frontend — only `name`, `issuer`, `issued_date`, `category`.
- Generated .docx files streamed to browser, never persisted.

---

## Error Handling

- **Gemini extraction fails:** mark cert as uploaded but show warning "datos no extraídos — editar manualmente". User can fill fields.
- **Gemini rate limit hit (15 RPM):** FastAPI queues extraction jobs with exponential backoff, max 3 retries. Returns 429 with `Retry-After` header if all retries fail.
- **PDF has no extractable text (scanned):** PyMuPDF detects empty text → falls back to Gemini Vision automatically.
- **Job posting file too large:** reject at Next.js layer before hitting FastAPI (413 response).
- **FastAPI down (Render cold start):** Next.js shows "El servicio está iniciando, reintentá en 30 segundos." Render free tier has cold starts of ~30s after inactivity.

---

## Constraints & Known Limitations

- **Render free tier cold start:** ~30s after 15min inactivity. Acceptable for personal use.
- **Gemini free tier:** 15 RPM, 1M tokens/day. Sufficient for individual + small group use. If usage grows, upgrade to paid Gemini or add queue.
- **Supabase free tier:** 500MB storage, 50MB DB, 2GB bandwidth/month. Sufficient for personal use with ~90-200 cert files.
- **No CV history:** generated files are not stored. If user wants to regenerate, they re-submit the job posting.

---

## Out of Scope (v1)

- Email notifications
- CV history / versioning
- Admin panel for managing users
- Bulk cert import
- Integration with job boards (LinkedIn, Bumeran, etc.)
- CV template selection (single ATS-optimized template only)
