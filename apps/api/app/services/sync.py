from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Callable, Iterable

from app.core.config import get_settings


@dataclass(frozen=True)
class SyncResult:
    funds_seen: int
    nav_rows_seen: int
    synced_at: date


@dataclass(frozen=True)
class IndexSyncResult:
    indices_seen: int
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


def normalize_akshare_fund_rows(rows: Iterable[dict]) -> list[dict]:
    normalized = []
    for row in rows:
        normalized.append(
            {
                "code": str(row.get("基金代码") or row.get("code")),
                "name": str(row.get("基金简称") or row.get("name")),
                "fund_type": str(row.get("基金类型") or row.get("fund_type") or "未知"),
                "manager": str(row.get("基金管理人") or row.get("manager") or "未知"),
                "inception_date": row.get("成立日期")
                or row.get("inception_date")
                or date(1970, 1, 1),
                "latest_nav": row.get("最新净值") or row.get("latest_nav"),
                "latest_nav_date": row.get("最新净值日期") or row.get("latest_nav_date"),
                "asset_size_billion": row.get("资产规模") or row.get("asset_size_billion") or 0,
            }
        )
    return normalized


def sync_funds_to_supabase(
    client,
    fund_rows: Iterable[dict],
    nav_provider: Callable[[str], Iterable[dict]],
    max_funds: int | None = None,
) -> SyncResult:
    funds = normalize_akshare_fund_rows(fund_rows)
    if max_funds is not None:
        funds = funds[:max_funds]

    if funds:
        client.table("funds").upsert(funds, on_conflict="code").execute()

    nav_rows_seen = 0
    for fund in funds:
        raw_nav = list(nav_provider(fund["code"]))
        nav_rows = [
            {"code": fund["code"], **row} for row in normalize_akshare_nav_rows(raw_nav)
        ]
        if nav_rows:
            latest = nav_rows[-1]
            fund["latest_nav"] = latest["nav"]
            fund["latest_nav_date"] = latest["date"]
            client.table("fund_nav").upsert(nav_rows, on_conflict="code,date").execute()
            nav_rows_seen += len(nav_rows)

    if funds:
        client.table("funds").upsert(funds, on_conflict="code").execute()

    return SyncResult(
        funds_seen=len(funds),
        nav_rows_seen=nav_rows_seen,
        synced_at=date.today(),
    )


def sync_indices_to_supabase(
    client,
    indices: Iterable[dict],
    nav_provider: Callable[[str], Iterable[dict]],
) -> IndexSyncResult:
    index_rows = [dict(index) for index in indices]
    nav_rows_seen = 0

    if index_rows:
        client.table("market_indices").upsert(
            index_rows,
            on_conflict="code",
        ).execute()

    for index in index_rows:
        raw_nav = list(nav_provider(index["code"]))
        nav_rows = [{"code": index["code"], **row} for row in raw_nav]
        if not nav_rows:
            continue

        latest = nav_rows[-1]
        index["latest_value"] = latest.get("raw_value") or latest["nav"]
        index["latest_date"] = latest["date"]
        client.table("market_index_nav").upsert(
            nav_rows,
            on_conflict="code,date",
        ).execute()
        nav_rows_seen += len(nav_rows)

    if index_rows:
        client.table("market_indices").upsert(index_rows, on_conflict="code").execute()

    return IndexSyncResult(
        indices_seen=len(index_rows),
        nav_rows_seen=nav_rows_seen,
        synced_at=date.today(),
    )


def run_daily_sync() -> SyncResult:
    """Entry point for Render cron jobs.

    Uses AKShare's public-fund endpoints when production credentials are
    configured. Without credentials or AKShare opt-in, this remains side-effect
    free for local development.
    """

    settings = get_settings()
    if (
        not settings.akshare_enabled
        or not settings.supabase_url
        or not settings.supabase_service_role_key
    ):
        return SyncResult(funds_seen=0, nav_rows_seen=0, synced_at=date.today())

    import akshare as ak
    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    fund_rows = ak.fund_name_em().to_dict("records")

    def nav_provider(code: str):
        return ak.fund_open_fund_info_em(
            symbol=code,
            indicator="单位净值走势",
        ).to_dict("records")

    return sync_funds_to_supabase(client, fund_rows, nav_provider)


def run_daily_index_sync() -> IndexSyncResult:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return IndexSyncResult(indices_seen=0, nav_rows_seen=0, synced_at=date.today())

    from supabase import create_client

    from app.repositories.indices import INDEX_DEFINITIONS, LiveIndexRepository

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    repository = LiveIndexRepository()
    indices = [
        {
            "code": code,
            "name": str(definition["name"]),
            "symbol": str(definition["symbol"]),
            "return_type": str(definition["return_type"]),
            "currency": str(definition["currency"]),
            "provider": str(definition["provider"]),
            "description": str(definition["description"]),
        }
        for code, definition in INDEX_DEFINITIONS.items()
    ]
    return sync_indices_to_supabase(
        client,
        indices,
        nav_provider=lambda code: repository.get_raw_nav(code),
    )
