# 1000er.ai — Retail Shelf Intelligence Platform

## What is this project?

SaaS multi-tenant platform for retail shelf intelligence. Users upload photos of supermarket shelves and the platform detects products, facings, prices, and out-of-stock situations using AI vision.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, TypeScript, Tailwind CSS) |
| Backend API | FastAPI (Python 3.11+) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT, row-level security) |
| Image Storage | Supabase Storage (buckets per tenant) |
| AI Vision | OpenAI GPT-4 Vision API |
| Deployment | Vercel (frontend), Railway/Fly.io (backend) |

## Architecture Decisions

### Multi-tenancy
- **Strategy**: shared database, shared schema, `tenant_id` column in every table.
- Every query MUST filter by `tenant_id`. Use Supabase RLS policies as a safety net.
- API endpoints receive `tenant_id` from the authenticated JWT — never from request params.

### Image Analysis Pipeline
1. User uploads shelf photo → stored in Supabase Storage (`shelves/{tenant_id}/{upload_id}/`).
2. Backend creates an `analysis` record with status `pending`.
3. Background worker sends image to GPT-4 Vision with a structured prompt.
4. Response is parsed into: detected products, facing count, price (if visible), position, out-of-stock flags.
5. Results saved to DB; status updated to `completed`.
6. Frontend polls or uses Supabase Realtime to show results.

### API Design
- RESTful, versioned: `/api/v1/...`
- Auth via Bearer token (Supabase JWT).
- Standard response envelope: `{ data, error, meta }`.

### Data Model (core tables)
- `tenants` — id, name, plan, created_at
- `users` — id, tenant_id, email, role, created_at
- `stores` — id, tenant_id, name, address, chain
- `shelf_uploads` — id, tenant_id, store_id, image_url, uploaded_by, created_at
- `analyses` — id, tenant_id, shelf_upload_id, status, raw_response, created_at
- `detected_products` — id, analysis_id, tenant_id, product_name, brand, facings, price, position_x, position_y, is_oos, confidence

### MVP Scope
- Single-provider support (one supermarket chain per tenant).
- Manual photo upload (no automated capture yet).
- Dashboard: upload history, detection results, basic KPIs (total facings, OOS rate).
- User roles: admin, analyst.

### Post-MVP
- Multi-provider support per tenant.
- Planogram compliance comparison.
- Historical trend analysis.
- Bulk upload and scheduled analysis.
- Webhook/integration API for third-party systems.

## Project Structure

```
1000er.ai/
├── CLAUDE.md
├── frontend/                  # Next.js app
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── (auth)/        # Login, signup
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── uploads/       # Upload & review
│   │   │   ├── analysis/      # Analysis results
│   │   │   └── settings/      # Tenant settings
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # Supabase client, utils
│   │   ├── hooks/             # Custom React hooks
│   │   └── types/             # TypeScript types
│   ├── public/
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── package.json
├── backend/                   # FastAPI app
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint
│   │   ├── config.py          # Settings / env vars
│   │   ├── deps.py            # Dependency injection (DB, auth)
│   │   ├── models/            # SQLAlchemy / Pydantic models
│   │   ├── routers/           # API route modules
│   │   │   ├── uploads.py
│   │   │   ├── analyses.py
│   │   │   ├── stores.py
│   │   │   └── tenants.py
│   │   ├── services/          # Business logic
│   │   │   ├── vision.py      # GPT-4 Vision integration
│   │   │   └── analysis.py    # Analysis orchestration
│   │   ├── workers/           # Background tasks
│   │   └── utils/
│   ├── alembic/               # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── supabase/                  # Supabase config & migrations
│   ├── migrations/
│   └── seed.sql
└── docs/                      # Additional documentation
```

## Coding Conventions

- **Python**: snake_case, type hints everywhere, Pydantic for validation.
- **TypeScript**: camelCase for variables/functions, PascalCase for components/types.
- **SQL**: snake_case, plural table names.
- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, etc.).
- **Environment variables**: `.env.local` (frontend), `.env` (backend). Never commit secrets.

## Key Environment Variables

### Backend
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`
- `DATABASE_URL`

### Frontend
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

## Commands

```bash
# Frontend
cd frontend && npm run dev        # Dev server on :3000
cd frontend && npm run build      # Production build
cd frontend && npm run lint       # Lint

# Backend
cd backend && uvicorn app.main:app --reload   # Dev server on :8000
cd backend && alembic upgrade head            # Run migrations
cd backend && pytest                          # Run tests
```
