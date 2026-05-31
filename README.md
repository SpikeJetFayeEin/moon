# Moon Fund Analytics

Moon is a monorepo for a Chinese public fund analysis website.

- `apps/web`: React/Vite frontend for fund screening, fund detail analysis, comparison, and Google login.
- `apps/api`: FastAPI backend for fund data, NAV history, metrics, watchlists, and saved comparison lists.
- `supabase/schema.sql`: Postgres schema for funds, NAV history, cached metrics, profiles, watchlists, and saved compare lists.

The first version focuses on objective fund analysis from NAV history. It does not show hot funds, fund ratings, recommendations, or investment advice.

## Local development

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

Backend:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The frontend has fixture fallbacks, so the page can be previewed before the backend, Supabase, and AKShare are configured.

## Environment

Copy `.env.example` files in `apps/web` and `apps/api`, then fill in Supabase and API settings.

## Deployment

See `docs/deployment.md` for Vercel, Render, and Supabase setup.
