from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable


@dataclass(frozen=True)
class SyncResult:
    funds_seen: int
    nav_rows_seen: int
    synced_at: date


def normalize_akshare_nav_rows(rows: Iterable[dict]) -> list[dict]:
    normalized = []
    for row in rows:
        normalized.append(
            {
                "date": row.get("净值日期") or row.get("date"),
                "nav": float(row.get("单位净值") or row.get("nav")),
                "accumulated_nav": float(row.get("累计净值") or row.get("nav")),
            }
        )
    return normalized


def run_daily_sync() -> SyncResult:
    """Entry point for Render cron jobs.

    Production deployments should configure Supabase credentials and enable
    AKShare in the environment. The local implementation keeps this side-effect
    free so development and tests do not depend on external data providers.
    """

    return SyncResult(funds_seen=0, nav_rows_seen=0, synced_at=date.today())
