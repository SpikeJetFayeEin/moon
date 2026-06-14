from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_fund_manager_repository,
    get_fund_manager_sync_trigger,
    get_fund_repository,
    get_fund_sync_trigger,
    get_index_sync_trigger,
    get_index_repository,
    FundManagerSyncTrigger,
    FundSyncTrigger,
    IndexSyncTrigger,
)
from app.core.config import get_settings
from app.models.schemas import (
    DeleteSyncResponse,
    DrawdownSeriesResponse,
    Fund,
    FundPerformanceResponse,
    FundProfile,
    FundListResponse,
    FundManager,
    FundManagerListResponse,
    FundManagerProductComparisonItem,
    FundManagerProductComparisonResponse,
    FundManagerSyncResponse,
    FundMetrics,
    MarketIndex,
    MarketIndexListResponse,
    NavPoint,
    ReadinessResponse,
    SyncResponse,
)
from app.repositories.funds import FundRepository
from app.repositories.indices import IndexRepository
from app.repositories.managers import FundManagerRepository
from app.services.metrics import calculate_drawdown_series, calculate_fund_metrics


router = APIRouter()
ManagerComparisonPeriod = Literal["1m", "3m", "6m", "1y", "3y"]
PERIOD_DAYS: dict[str, int] = {"1m": 30, "3m": 90, "6m": 180, "1y": 365, "3y": 365 * 3}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readiness", response_model=ReadinessResponse)
def readiness() -> ReadinessResponse:
    settings = get_settings()
    checks = {
        "cors_origins": bool(settings.cors_origin_list),
        "supabase_database": bool(settings.supabase_url and settings.supabase_service_role_key),
        "supabase_auth_jwt": bool(settings.supabase_jwt_secret),
        "akshare_sync": bool(settings.akshare_enabled),
    }
    required_env = {
        "API_CORS_ORIGINS": checks["cors_origins"],
        "SUPABASE_URL": bool(settings.supabase_url),
        "SUPABASE_SERVICE_ROLE_KEY": bool(settings.supabase_service_role_key),
        "SUPABASE_JWT_SECRET": bool(settings.supabase_jwt_secret),
        "AKSHARE_ENABLED": bool(settings.akshare_enabled),
    }
    status = "ready" if all(checks.values()) else "degraded"
    return ReadinessResponse(
        status=status,
        checks=checks,
        configured_env=[key for key, configured in required_env.items() if configured],
        missing_env=[key for key, configured in required_env.items() if not configured],
    )


@router.get("/funds", response_model=FundListResponse)
def list_funds(
    q: str | None = None,
    fund_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundListResponse:
    items, total = fund_repository.list_funds(q, fund_type, max(page, 1), page_size)
    items = [_with_fund_summary(item, fund_repository) for item in items]
    return FundListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/fund-managers", response_model=FundManagerListResponse)
def list_fund_managers(
    q: str | None = None,
    fund_manager_repository: FundManagerRepository = Depends(get_fund_manager_repository),
) -> FundManagerListResponse:
    items = fund_manager_repository.list_managers(q)
    return FundManagerListResponse(items=items, total=len(items))


@router.post("/fund-managers/sync", response_model=FundManagerSyncResponse)
def sync_fund_managers(
    sync_trigger: FundManagerSyncTrigger = Depends(get_fund_manager_sync_trigger),
) -> FundManagerSyncResponse:
    result = sync_trigger()
    return FundManagerSyncResponse(
        managers_seen=result.managers_seen,
        tenures_seen=result.tenures_seen,
        synced_at=result.synced_at,
        status="synced" if result.managers_seen else "skipped",
    )


@router.get("/fund-managers/{manager_id}", response_model=FundManager)
def get_fund_manager(
    manager_id: str,
    fund_manager_repository: FundManagerRepository = Depends(get_fund_manager_repository),
) -> FundManager:
    manager = fund_manager_repository.get_manager(manager_id)
    if manager is None:
        raise HTTPException(status_code=404, detail="Fund manager not found.")
    return manager


@router.get(
    "/fund-managers/{manager_id}/products/comparison",
    response_model=FundManagerProductComparisonResponse,
)
def get_fund_manager_product_comparison(
    manager_id: str,
    period: ManagerComparisonPeriod = "1y",
    fund_manager_repository: FundManagerRepository = Depends(get_fund_manager_repository),
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundManagerProductComparisonResponse:
    manager = fund_manager_repository.get_manager(manager_id)
    if manager is None:
        raise HTTPException(status_code=404, detail="Fund manager not found.")

    items = [
        _build_product_comparison_item(tenure, fund_repository, period)
        for tenure in fund_manager_repository.list_active_tenures(manager_id)
    ]
    return FundManagerProductComparisonResponse(
        manager_id=manager_id,
        period=period,
        items=items,
    )


@router.get("/funds/{code}")
def get_fund(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
):
    fund = fund_repository.get_fund(code)
    if fund is None:
        raise HTTPException(status_code=404, detail="Fund not found.")
    return fund


@router.post("/funds/{code}/sync", response_model=SyncResponse)
def sync_selected_fund(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
    fund_sync_trigger: FundSyncTrigger = Depends(get_fund_sync_trigger),
) -> SyncResponse:
    fund = fund_repository.get_fund(code) or _unknown_fund(code)
    result = fund_sync_trigger(fund)
    return SyncResponse(
        asset_type="fund",
        code=fund.code,
        items_seen=result.funds_seen,
        nav_rows_seen=result.nav_rows_seen,
        synced_at=result.synced_at,
        status="synced" if result.funds_seen else "skipped",
    )


@router.delete("/funds/{code}/sync", response_model=DeleteSyncResponse)
def delete_synced_fund(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> DeleteSyncResponse:
    deleted = fund_repository.delete_fund(code)
    return DeleteSyncResponse(
        asset_type="fund",
        code=code.strip(),
        deleted=deleted,
        status="deleted" if deleted else "missing",
    )


@router.get("/funds/{code}/profile", response_model=FundProfile)
def get_fund_profile(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundProfile:
    profile = fund_repository.get_profile(code)
    if profile is None:
        raise HTTPException(status_code=404, detail="Fund profile not found.")
    return profile


@router.get("/funds/{code}/performance", response_model=FundPerformanceResponse)
def get_fund_performance(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundPerformanceResponse:
    return FundPerformanceResponse(code=code, items=fund_repository.get_performance(code))


@router.get("/funds/{code}/nav")
def get_nav(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
):
    nav = fund_repository.get_nav(code)
    if not nav:
        raise HTTPException(status_code=404, detail="NAV series not found.")
    return {"code": code, "items": nav}


@router.get("/funds/{code}/drawdowns", response_model=DrawdownSeriesResponse)
def get_drawdowns(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> DrawdownSeriesResponse:
    raw_nav = fund_repository.get_raw_nav(code)
    if not raw_nav:
        raise HTTPException(status_code=404, detail="NAV series not found.")
    return DrawdownSeriesResponse(code=code, items=calculate_drawdown_series(raw_nav))


@router.get("/funds/{code}/metrics", response_model=FundMetrics)
def get_metrics(
    code: str,
    start_date: date | None = None,
    end_date: date | None = None,
    holding_days: int = 30,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundMetrics:
    raw_nav = fund_repository.get_raw_nav(code)
    if not raw_nav:
        raise HTTPException(status_code=404, detail="NAV series not found.")
    metrics = calculate_fund_metrics(
        raw_nav,
        start_date=start_date,
        end_date=end_date,
        holding_days=holding_days,
    )
    metrics.code = code
    return metrics


@router.get("/indices", response_model=MarketIndexListResponse)
def list_indices(
    index_repository: IndexRepository = Depends(get_index_repository),
) -> MarketIndexListResponse:
    return MarketIndexListResponse(items=index_repository.list_indices())


@router.get("/indices/{code}")
def get_index(
    code: str,
    index_repository: IndexRepository = Depends(get_index_repository),
):
    market_index = index_repository.get_index(code)
    if market_index is None:
        raise HTTPException(status_code=404, detail="Index not found.")
    return market_index


@router.post("/indices/{code}/sync", response_model=SyncResponse)
def sync_selected_index(
    code: str,
    index_repository: IndexRepository = Depends(get_index_repository),
    index_sync_trigger: IndexSyncTrigger = Depends(get_index_sync_trigger),
) -> SyncResponse:
    market_index = index_repository.get_index(code) or _unknown_index(code)
    result = index_sync_trigger(market_index)
    return SyncResponse(
        asset_type="index",
        code=market_index.code.lower(),
        items_seen=result.indices_seen,
        nav_rows_seen=result.nav_rows_seen,
        synced_at=result.synced_at,
        status="synced" if result.indices_seen else "skipped",
    )


@router.delete("/indices/{code}/sync", response_model=DeleteSyncResponse)
def delete_synced_index(
    code: str,
    index_repository: IndexRepository = Depends(get_index_repository),
) -> DeleteSyncResponse:
    normalized_code = code.strip().lower()
    deleted = index_repository.delete_index(normalized_code)
    return DeleteSyncResponse(
        asset_type="index",
        code=normalized_code,
        deleted=deleted,
        status="deleted" if deleted else "missing",
    )


@router.get("/indices/{code}/nav")
def get_index_nav(
    code: str,
    index_repository: IndexRepository = Depends(get_index_repository),
):
    nav = index_repository.get_nav(code)
    if not nav:
        raise HTTPException(status_code=404, detail="Index NAV series not found.")
    return {"code": code.lower(), "items": nav}


@router.get("/indices/{code}/drawdowns", response_model=DrawdownSeriesResponse)
def get_index_drawdowns(
    code: str,
    index_repository: IndexRepository = Depends(get_index_repository),
) -> DrawdownSeriesResponse:
    raw_nav = index_repository.get_raw_nav(code)
    if not raw_nav:
        raise HTTPException(status_code=404, detail="Index NAV series not found.")
    return DrawdownSeriesResponse(
        code=code.lower(),
        items=calculate_drawdown_series(raw_nav),
    )


@router.get("/indices/{code}/metrics", response_model=FundMetrics)
def get_index_metrics(
    code: str,
    start_date: date | None = None,
    end_date: date | None = None,
    holding_days: int = 30,
    index_repository: IndexRepository = Depends(get_index_repository),
) -> FundMetrics:
    raw_nav = index_repository.get_raw_nav(code)
    if not raw_nav:
        raise HTTPException(status_code=404, detail="Index NAV series not found.")
    metrics = calculate_fund_metrics(
        raw_nav,
        start_date=start_date,
        end_date=end_date,
        holding_days=holding_days,
    )
    metrics.code = code.lower()
    return metrics


def _with_fund_summary(fund, fund_repository: FundRepository):
    raw_nav = fund_repository.get_raw_nav(fund.code)
    if len(raw_nav) < 2:
        return fund
    try:
        metrics = calculate_fund_metrics(raw_nav)
    except ValueError:
        return fund
    return fund.model_copy(
        update={
            "return_1m": metrics.period_returns.get("1m"),
            "drawdown_1m": metrics.period_drawdowns.get("1m"),
            "return_1y": metrics.period_returns.get("1y"),
            "drawdown_1y": metrics.period_drawdowns.get("1y"),
            "max_drawdown": metrics.max_drawdown,
            "volatility": metrics.volatility,
            "sharpe_ratio": metrics.sharpe_ratio,
        }
    )


def _build_product_comparison_item(
    tenure,
    fund_repository: FundRepository,
    period: str,
) -> FundManagerProductComparisonItem:
    fund = fund_repository.get_fund(tenure.fund_code)
    raw_nav = _filter_nav_for_period(fund_repository.get_raw_nav(tenure.fund_code), period)

    if len(raw_nav) < 2:
        return FundManagerProductComparisonItem(
            code=tenure.fund_code,
            name=fund.name if fund is not None else tenure.fund_name,
            fund_type=fund.fund_type if fund is not None else None,
            asset_size_billion=fund.asset_size_billion if fund is not None else None,
            latest_nav_date=fund.latest_nav_date if fund is not None else None,
            return_rate=None,
            annualized_return=None,
            volatility=None,
            max_drawdown=None,
            sharpe_ratio=None,
            nav=[],
            status="pending_data",
        )

    try:
        metrics = calculate_fund_metrics(raw_nav)
    except ValueError:
        return FundManagerProductComparisonItem(
            code=tenure.fund_code,
            name=fund.name if fund is not None else tenure.fund_name,
            fund_type=fund.fund_type if fund is not None else None,
            asset_size_billion=fund.asset_size_billion if fund is not None else None,
            latest_nav_date=fund.latest_nav_date if fund is not None else None,
            return_rate=None,
            annualized_return=None,
            volatility=None,
            max_drawdown=None,
            sharpe_ratio=None,
            nav=[],
            status="pending_data",
        )

    return FundManagerProductComparisonItem(
        code=tenure.fund_code,
        name=fund.name if fund is not None else tenure.fund_name,
        fund_type=fund.fund_type if fund is not None else None,
        asset_size_billion=fund.asset_size_billion if fund is not None else None,
        latest_nav_date=fund.latest_nav_date if fund is not None else _nav_date(raw_nav[-1]),
        return_rate=round(metrics.total_return, 10),
        annualized_return=metrics.annualized_return,
        volatility=metrics.volatility,
        max_drawdown=metrics.max_drawdown,
        sharpe_ratio=metrics.sharpe_ratio,
        nav=[
            NavPoint(
                date=_nav_date(point),
                nav=float(point["nav"]),
                accumulated_nav=point.get("accumulated_nav"),
            )
            for point in raw_nav
        ],
        status="ready",
    )


def _filter_nav_for_period(raw_nav: list[dict], period: str) -> list[dict]:
    points = sorted(raw_nav, key=_nav_date)
    if not points:
        return []
    cutoff = _nav_date(points[-1]) - timedelta(days=PERIOD_DAYS[period])
    return [point for point in points if _nav_date(point) >= cutoff]


def _nav_date(point: dict) -> date:
    value = point["date"]
    return value if isinstance(value, date) else date.fromisoformat(str(value))


def _unknown_fund(code: str) -> Fund:
    normalized_code = code.strip()
    return Fund(
        code=normalized_code,
        name=f"待同步基金 {normalized_code}",
        fund_type="待同步",
        manager="待同步",
        fund_manager=None,
        inception_date=date(1970, 1, 1),
        latest_nav=None,
        latest_nav_date=None,
        asset_size_billion=None,
    )


def _unknown_index(code: str) -> MarketIndex:
    normalized_code = code.strip().lower()
    symbol = normalized_code.upper()
    return MarketIndex(
        code=normalized_code,
        name=f"待同步指数 {symbol}",
        symbol=symbol,
        return_type="price",
        currency="USD",
        provider="Yahoo Finance",
        description="通过搜索框添加的指数候选，首次同步后写入数据库。",
        latest_value=0,
        latest_date=date.today(),
    )
