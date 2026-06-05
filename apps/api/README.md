# Moon Fund API

FastAPI backend for fund search, NAV history, risk metrics, comparisons, watchlists, and saved compare lists.

## Local development

```bash
cd apps/api
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

The API serves seed data by default, so the frontend can be previewed before Supabase and AKShare are configured.

## Tests

```bash
cd apps/api
uv run pytest -q
```

## Daily sync

```bash
cd apps/api
uv run python scripts/sync_funds.py
uv run python scripts/sync_indices.py
```

Production sync should run after Supabase credentials and AKShare access are configured.

The sync command uses AKShare public fund endpoints:

- `fund_name_em()` for fund code, name, and type.
- `fund_open_fund_info_em(symbol=code, indicator="单位净值走势")` for historical NAV.
- `fund_individual_basic_info_xq(symbol=code, timeout=5)` for fund profile fields saved to `funds`.
- `fund_individual_achievement_xq(symbol=code, timeout=5)` for stage/year performance saved to `fund_performance`.

The production fund detail endpoints are database-first: page reads query Supabase
tables only and do not call AKShare. Run the sync command on a schedule to keep
external data warm before users open detail pages.

Adding a fund to a user's watchlist also schedules a background sync for that
fund, so newly selected funds can be warmed without waiting for the next daily
cron run.

When `AKSHARE_ENABLED=false` or Supabase credentials are missing, the command exits without side effects.

The index sync command writes the Nasdaq-100 Total Return (`XNDX`) and S&P 500
Total Return (`^SP500TR`) metadata and normalized total-return NAV series into
`market_indices` and `market_index_nav`. It does not need realtime quotes.
