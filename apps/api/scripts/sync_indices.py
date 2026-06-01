from app.services.sync import run_daily_index_sync


if __name__ == "__main__":
    result = run_daily_index_sync()
    print(
        f"Synced {result.indices_seen} indices and {result.nav_rows_seen} NAV rows "
        f"at {result.synced_at.isoformat()}."
    )
