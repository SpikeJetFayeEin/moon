# Deployment

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Google as an auth provider.
4. Add local redirect URL: `http://localhost:5173`.
5. Add production redirect URL after Vercel deploys the frontend.
6. Copy project URL and anon key into `apps/web/.env`.
7. Copy project URL, service role key, and JWT secret into `apps/api/.env`.

The schema creates `public.profiles` and a trigger on `auth.users` so Google
OAuth users can immediately save watchlists and compare lists without manually
creating profile rows.

## Vercel frontend

Use the repository root as the Vercel project root.

Build settings:

- Build command: `npm install && npm run build:web`
- Output directory: `apps/web/dist`

Environment variables:

- `VITE_API_BASE_URL`: deployed API URL, for example `https://moon-api.onrender.com`
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key

The frontend uses Supabase OAuth in the browser. After Google login, it sends
the Supabase access token to the FastAPI backend as `Authorization: Bearer ...`
for watchlists and saved compare lists. The backend validates that token when
`SUPABASE_JWT_SECRET` is configured.

Before deploying, GitHub Actions CI should pass for both jobs:

- Backend: `ruff check app tests` and `pytest -q`
- Frontend: `npm ci`, `npm run build:web`, and `npm audit --audit-level=moderate`

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

Add a second Render Cron Job for overseas total-return indices:

- Command: `python scripts/sync_indices.py`
- Schedule: once per day. Realtime quotes are not required.

The sync job reads AKShare public-fund data with `fund_name_em()` and
`fund_open_fund_info_em(symbol=code, indicator="单位净值走势")`, then upserts into
`public.funds` and `public.fund_nav`. AKShare documents that the open-fund NAV
endpoint returns the full historical series for a fund code, so the first sync
can be heavy; keep Render Free resource limits in mind.

The index sync stores Nasdaq-100 Total Return (`XNDX`) and S&P 500 Total Return
(`^SP500TR`) rows in `public.market_indices` and `public.market_index_nav`.

Render Free can sleep or cold start. Upgrade the backend service when stable demos or always-on access matter.

## Visual preview without Node tooling

Open `docs/preview.html` directly in a browser to review the current dashboard,
account panel, metric cards, fund table, and detail-analysis visual direction
without installing frontend dependencies. This preview is static; the runnable
application remains `apps/web`.
