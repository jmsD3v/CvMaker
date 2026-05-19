# CvMaker

**Generá un CV ATS-optimizado y una carta de presentación en segundos.**

Subí el aviso laboral → la app lee tu perfil completo → genera `CV.docx` + `Carta.docx` listos para usar.

---

## ¿Qué hace?

| Feature | Detalle |
|---|---|
| **Generación de CV** | Paste del aviso laboral → CV ATS-optimizado en español con keywords exactas del aviso |
| **Carta de presentación** | Generada junto al CV, personalizada al rol y empresa |
| **Extracción de certificaciones** | Subís PDF/PNG/JPG → IA extrae nombre, emisor, fecha y categoría automáticamente |
| **Perfil completo** | Gestión de contacto, experiencia laboral y educación desde la app |
| **Descarga directa** | `.zip` con `CV.docx` + `Carta.docx` listos para adjuntar |
| **Multi-usuario** | Cada usuario tiene su propio perfil y datos aislados con RLS |

---

## Stack

```
Frontend          Next.js 15 · TypeScript · Tailwind CSS · pnpm · Vercel
Backend           Python FastAPI · Render (free tier)
Base de datos     Supabase (PostgreSQL + Auth + Storage)
IA                Google Gemini Flash 2.0 (free tier — 1M tokens/día)
Documentos        python-docx
PDF parsing       PyMuPDF (sin costo de IA para PDFs nativos)
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   Vercel (Next.js)               │
│                                                  │
│  /login          Magic link · Email+password     │
│  /dashboard      Resumen del perfil              │
│  /profile        Contacto · Experiencia · Edu.  │
│  /certifications Upload + lista de certs         │
│  /generate       Ingreso del aviso → descarga    │
│                                                  │
│  /api/*          Route handlers (proxy + CRUD)   │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS + JWT
┌──────────────────────▼──────────────────────────┐
│                  Render (FastAPI)                │
│                                                  │
│  POST /certs/extract   Descarga archivo Storage  │
│                        → PyMuPDF o Gemini Vision │
│                        → actualiza DB            │
│                                                  │
│  POST /generate        Lee perfil completo de DB │
│                        → Gemini Flash genera CV  │
│                        → python-docx construye   │
│                        → devuelve .zip           │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                  Supabase                        │
│                                                  │
│  Auth      Magic link · Email+password · JWT     │
│  Postgres  profiles · experience · education     │
│            certifications (RLS en todas)         │
│  Storage   Bucket privado: {user_id}/{uuid}.ext  │
└─────────────────────────────────────────────────┘
```

---

## Desarrollo local

### Requisitos

- Node.js 20+ · pnpm · Python 3.11+
- Cuenta Supabase (free)
- API Key de Google AI Studio (Gemini free tier)

### 1. Clonar

```bash
git clone https://github.com/jmsD3v/CvMaker.git
cd CvMaker
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus credenciales
uvicorn main:app --reload
```

`.env` necesita:
```env
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
pnpm install
cp .env.local.example .env.local
# Editar .env.local con tus credenciales
pnpm dev
```

`.env.local` necesita:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
BACKEND_URL=http://localhost:8000
```

### 4. Supabase

En el SQL Editor de tu proyecto Supabase, ejecutar en orden:

```
backend/migrations/001_initial_schema.sql
backend/migrations/002_storage_rls.sql
```

Crear el bucket de Storage:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('certifications', 'certifications', false);
```

### 5. Tests

```bash
cd backend
python -m pytest tests/ -v
```

---

## Deploy

Ver [DEPLOY.md](DEPLOY.md) para instrucciones completas de Supabase → Render → Vercel.

---

## Seed (primer uso)

Después del primer login, cargar datos de perfil:

```bash
cd seed
pip install supabase python-dotenv
python seed.py juanmanuelsilva06@gmail.com
```

Requiere `backend/.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

---

## Flujo de uso

```
1. Login con magic link o email+password
2. (Nuevo usuario) Wizard de onboarding — contacto + primera experiencia
3. Subir certificaciones → extracción automática por IA
4. Ir a "Generar CV" → pegar o cargar aviso laboral
5. Click en "Generar" → descarga cvmaker_output.zip
6. Abrir ZIP → CV.docx + Carta.docx listos
```

---

## Seguridad

- **RLS** en todas las tablas — cada usuario solo ve y modifica sus propios datos
- **Storage RLS** — solo acceso a `{user_id}/` propio
- **JWT validado** en FastAPI con `SUPABASE_JWT_SECRET` (HS256, audience `authenticated`)
- **user_id verificado** contra JWT sub en cada endpoint del backend
- **Rate limiting** — 10 req/min en `/certs/extract`, 5 req/min en `/generate`
- **MIME whitelist** en upload — solo `application/pdf`, `image/png`, `image/jpeg`
- **CORS** restringido a `FRONTEND_URL`

---

## Estructura del proyecto

```
CvMaker/
├── frontend/                   # Next.js App Router
│   ├── app/
│   │   ├── (auth)/login/       # Login page
│   │   ├── (protected)/        # Rutas autenticadas
│   │   │   ├── dashboard/
│   │   │   ├── profile/        # contact · experience · education
│   │   │   ├── certifications/
│   │   │   └── generate/
│   │   ├── api/                # Route handlers
│   │   │   ├── profile/
│   │   │   ├── certs/
│   │   │   └── generate/
│   │   └── onboarding/
│   ├── lib/
│   │   ├── supabase.ts         # Browser + server clients
│   │   └── api.ts              # BACKEND_URL
│   └── types/index.ts
│
├── backend/                    # FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── certs.py            # POST /certs/extract
│   │   └── generate.py         # POST /generate
│   ├── services/
│   │   ├── auth.py             # JWT validation
│   │   ├── extractor.py        # PyMuPDF + Gemini Vision
│   │   └── generator.py        # Gemini Flash + python-docx
│   ├── models/schemas.py
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_storage_rls.sql
│   ├── tests/
│   └── render.yaml
│
├── seed/
│   ├── seed.py
│   └── profile_data.py
│
└── DEPLOY.md
```

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio — [aistudio.google.com](https://aistudio.google.com) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Settings → API) |
| `SUPABASE_JWT_SECRET` | JWT Secret (Settings → API → JWT Settings) |
| `FRONTEND_URL` | URL del frontend (Vercel o localhost:3000) |

### Frontend (`frontend/.env.local`)

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key (Settings → API) |
| `BACKEND_URL` | URL del backend (Render o localhost:8000) |

---

## Límites del free tier

| Servicio | Límite |
|---|---|
| Gemini Flash 2.0 | 15 RPM · 1M tokens/día |
| Supabase | 500MB DB · 1GB Storage · 50K auth users |
| Render | 750h/mes · spin-down tras inactividad (cold start ~30s) |
| Vercel | 100GB bandwidth · builds ilimitados |

---

## Licencia

MIT
