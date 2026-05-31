# Deployment

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Google as an auth provider.
4. Add local redirect URL: `http://localhost:5173`.
5. Add production redirect URL after Vercel deploys the frontend.
6. Copy project URL and anon key into `apps/web/.env`.
7. Copy project URL, service role key, and JWT secret into `apps/api/.env`.

## Vercel frontend

Use the repository root as the Vercel project root.

Build settings:

- Build command: `npm install && npm run build:web`
- Output directory: `apps/web/dist`

Environment variables:

- `VITE_API_BASE_URL`: deployed API URL, for example `https://moon-api.onrender.com`
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key

## Render backend

Create a Web Service from this repository.

Settings:

- Root directory: `apps/api`
- Build command: `pip install -e ".[dev]"`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Environment variables:

- `API_CORS_ORIGINS`: `["http://localhost:5173","https://your-vercel-domain.vercel.app"]`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `AKSHARE_ENABLED=true`

For daily sync, add a Render Cron Job:

- Command: `python scripts/sync_funds.py`
- Schedule: once per day after NAV data is expected to be available.

Render Free can sleep or cold start. Upgrade the backend service when stable demos or always-on access matter.
