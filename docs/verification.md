# Verification

Last verified on 2026-05-31.

## Backend

```powershell
apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests -q
```

Result: `18 passed, 1 warning`.

```powershell
apps\api\.venv\Scripts\python.exe -m ruff check apps/api/app apps/api/tests
```

Result: `All checks passed!`.

## Frontend

The local machine did not have npm on `PATH`, so a portable official Node.js
runtime was unpacked under `.tools/` and ignored by git.

```powershell
$nodeDir = Join-Path (Get-Location) '.tools\node-v22.11.0-win-x64'
$env:PATH = "$nodeDir;$env:PATH"
npm install
npm run build:web
npm audit --audit-level=moderate
```

Results:

- `npm run build:web`: Vite production build completed successfully.
- `npm audit --audit-level=moderate`: `found 0 vulnerabilities`.

The GitHub Actions path also uses `npm ci`; it has been verified locally with
the generated `package-lock.json`.

## Runtime Preview

Preview servers used for browser verification:

```powershell
apps\api\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
cd apps\web
npm run preview -- --host 127.0.0.1 --port 4173
```

Browser verification covered:

- `/`
- `/funds/000300`
- `/compare?codes=000300,110022`

Each page returned HTTP 200, had no browser console errors, had no page errors,
and did not exceed the 1440px viewport width. Screenshots are stored in:

- `docs/preview-runtime-home.png`
- `docs/preview-runtime-detail.png`
- `docs/preview-runtime-compare.png`
