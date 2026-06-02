# Supabase Local Setup

This project has two separate Supabase connections:

- Browser auth in `apps/web/.env`
- Server-side database access in `apps/api/.env`

Fill these values from the Supabase Dashboard:

```env
# apps/web/.env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://krxuyljjeahfsxdeepmk.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

```env
# apps/api/.env
API_CORS_ORIGINS=["http://localhost:5173"]
SUPABASE_URL=https://krxuyljjeahfsxdeepmk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-or-secret-key>
SUPABASE_JWT_SECRET=<jwt-secret>
AKSHARE_ENABLED=false
```

Run `supabase/schema.sql` in the Supabase SQL editor before syncing data.

## Google OAuth

Enable Google in Supabase Dashboard -> Authentication -> Providers -> Google.

In Google Cloud Console, add this Authorized redirect URI to the OAuth client:

```text
https://krxuyljjeahfsxdeepmk.supabase.co/auth/v1/callback
```

In Supabase Dashboard -> Authentication -> URL Configuration:

- Site URL for local testing: `http://127.0.0.1:4173`
- Additional Redirect URLs:
  - `http://127.0.0.1:4173/auth/callback`
  - `http://localhost:4173/auth/callback`
  - `<production-frontend-url>/auth/callback`

After the production frontend is deployed, replace `<production-frontend-url>`
with the Vercel production URL and keep the same `/auth/callback` path.

The root `.mcp.json` configures the hosted Supabase MCP server in read-only
mode. After authentication and project selection, it can be changed to a
project-scoped URL:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=krxuyljjeahfsxdeepmk&read_only=true"
    }
  }
}
```
