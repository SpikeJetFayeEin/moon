from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_fund_repository,
    get_fund_sync_trigger,
    get_index_sync_trigger,
    get_index_repository,
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
    FundMetrics,
    MarketIndex,
    MarketIndexListResponse,
    ReadinessResponse,
    SyncResponse,
)
from app.repositories.funds import FundRepository
from app.repositories.indices import IndexRepository
from app.services.metrics import calculate_drawdown_series, calculate_fund_metrics


router = APIRouter()


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
