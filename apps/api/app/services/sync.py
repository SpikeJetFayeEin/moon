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
        nav = float(row.get("单位净值") or row.get("nav"))
        accumulated_nav = row.get("累计净值") or row.get("accumulated_nav") or nav
        normalized.append(
            {
                "date": row.get("净值日期") or row.get("date"),
                "nav": nav,
                "accumulated_nav": float(accumulated_nav),
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
                "fund_manager": row.get("基金经理") or row.get("fund_manager"),
                "inception_date": row.get("成立日期")
                or row.get("inception_date")
                or date(1970, 1, 1),
                "latest_nav": row.get("最新净值") or row.get("latest_nav"),
                "latest_nav_date": row.get("最新净值日期") or row.get("latest_nav_date"),
                "asset_size_billion": row.get("资产规模") or row.get("asset_size_billion") or 0,
            }
        )
    return normalized


def normalize_akshare_fund_profile_rows(code: str, rows: Iterable[dict]) -> dict:
    values = {
        str(row.get("item") or "").strip(): row.get("value")
        for row in rows
        if row.get("item")
    }
    return {
        "code": str(values.get("基金代码") or code),
        "name": str(values.get("基金名称") or values.get("基金简称") or ""),
        "full_name": _text_or_none(values.get("基金全称")),
        "inception_date": _date_or_none(values.get("成立时间") or values.get("成立日期")),
        "asset_size_billion": _asset_size_billion_or_none(values.get("最新规模")),
        "fund_company": _text_or_none(values.get("基金公司")),
        "fund_manager": _text_or_none(values.get("基金经理")),
        "custodian": _text_or_none(values.get("托管银行")),
        "fund_type": _text_or_none(values.get("基金类型")),
        "rating_source": _text_or_none(values.get("评级机构")),
        "rating": _text_or_none(values.get("基金评级")),
        "investment_strategy": _text_or_none(values.get("投资策略")),
        "investment_target": _text_or_none(values.get("投资目标")),
        "benchmark": _text_or_none(values.get("业绩比较基准")),
    }


def normalize_akshare_fund_performance_rows(rows: Iterable[dict]) -> list[dict]:
    normalized: list[dict] = []
    for row in rows:
        period = _text_or_none(row.get("周期"))
        if period is None:
            continue
        performance_type = "stage" if row.get("业绩类型") == "阶段业绩" else "year"
        normalized.append(
            {
                "performance_type": performance_type,
                "period": period,
                "return_rate": _percent_number_to_rate(row.get("本产品区间收益")),
                "max_drawdown": _drawdown_percent_to_rate(row.get("本产品最大回撒")),
                "rank": _text_or_none(row.get("周期收益同类排名")),
            }
        )
    return normalized


def _percent_number_to_rate(value) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value) / 100, 10)
    except (TypeError, ValueError):
        return None


def _drawdown_percent_to_rate(value) -> float | None:
    rate = _percent_number_to_rate(value)
    if rate is None:
        return None
    return -abs(rate)


def _text_or_none(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "<na>"}:
        return None
    return text


def _date_or_none(value) -> date | None:
    text = _text_or_none(value)
    if text is None:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _asset_size_billion_or_none(value) -> float | None:
    text = _text_or_none(value)
    if text is None:
        return None
    cleaned = text.replace(",", "").replace("亿元", "").replace("亿", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def sync_funds_to_supabase(
    client,
    fund_rows: Iterable[dict],
    nav_provider: Callable[[str], Iterable[dict]],
    profile_provider: Callable[[str], Iterable[dict]] | None = None,
    max_funds: int | None = None,
) -> SyncResult:
    funds = normalize_akshare_fund_rows(fund_rows)
    if max_funds is not None:
        funds = funds[:max_funds]

    if funds:
        client.table("funds").upsert(funds, on_conflict="code").execute()

    nav_rows_seen = 0
    for fund in funds:
        if profile_provider is not None:
            try:
                profile = normalize_akshare_fund_profile_rows(
                    fund["code"],
                    profile_provider(fund["code"]),
                )
                _merge_profile_into_fund_row(fund, profile)
            except Exception:
                pass

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


def _merge_profile_into_fund_row(fund: dict, profile: dict) -> None:
    for key in (
        "full_name",
        "fund_manager",
        "custodian",
        "benchmark",
        "investment_strategy",
        "investment_target",
        "rating_source",
        "rating",
    ):
        if profile.get(key) is not None:
            fund[key] = profile[key]

    if profile.get("fund_company") is not None:
        fund["manager"] = profile["fund_company"]
    if profile.get("fund_type") is not None:
        fund["fund_type"] = profile["fund_type"]
    if profile.get("inception_date") is not None:
        fund["inception_date"] = profile["inception_date"]
    if profile.get("asset_size_billion") is not None:
        fund["asset_size_billion"] = profile["asset_size_billion"]


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

    def profile_provider(code: str):
        return ak.fund_individual_basic_info_xq(symbol=code, timeout=5).to_dict("records")

    return sync_funds_to_supabase(client, fund_rows, nav_provider, profile_provider)


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
