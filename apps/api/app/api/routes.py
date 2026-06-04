from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import (
    get_fund_repository,
    get_index_repository,
    get_user_repository,
    require_user_id,
)
from app.core.config import get_settings
from app.models.schemas import (
    CompareItem,
    CompareList,
    CompareListCreate,
    CompareRequest,
    CompareResponse,
    DrawdownSeriesResponse,
    FundProfile,
    FundListResponse,
    FundMetrics,
    MarketIndexListResponse,
    PortfolioBacktestRequest,
    PortfolioBacktestResponse,
    ReadinessResponse,
    WatchlistItem,
)
from app.repositories.funds import FundRepository
from app.repositories.indices import IndexRepository
from app.repositories.users import UserRepository
from app.services.metrics import calculate_drawdown_series, calculate_fund_metrics
from app.services.portfolio import backtest_portfolio


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


@router.get("/funds/{code}/profile", response_model=FundProfile)
def get_fund_profile(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundProfile:
    profile = fund_repository.get_profile(code)
    if profile is None:
        raise HTTPException(status_code=404, detail="Fund profile not found.")
    return profile


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


@router.get("/indices/{code}/nav")
def get_index_nav(
    code: str,
    index_repository: IndexRepository = Depends(get_index_repository),
):
    nav = index_repository.get_nav(code)
    if not nav:
        raise HTTPException(status_code=404, detail="Index NAV series not found.")
    return {"code": code.lower(), "items": nav}


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


@router.post("/compare", response_model=CompareResponse)
def compare_funds(
    request: CompareRequest,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> CompareResponse:
    items: list[CompareItem] = []
    for code in request.codes:
        fund = fund_repository.get_fund(code)
        nav = fund_repository.get_nav(code)
        if fund is None or not nav:
            raise HTTPException(status_code=404, detail=f"Fund {code} not found.")
        metrics = calculate_fund_metrics(fund_repository.get_raw_nav(code))
        metrics.code = code
        items.append(
            CompareItem(
                code=code,
                name=fund.name,
                total_return=metrics.total_return,
                max_drawdown=metrics.max_drawdown,
                volatility=metrics.volatility,
                sharpe_ratio=metrics.sharpe_ratio,
                nav=nav,
            )
        )
    return CompareResponse(items=items)


@router.post("/portfolio/backtest", response_model=PortfolioBacktestResponse)
def portfolio_backtest(
    request: PortfolioBacktestRequest,
    fund_repository: FundRepository = Depends(get_fund_repository),
    index_repository: IndexRepository = Depends(get_index_repository),
) -> PortfolioBacktestResponse:
    series_by_asset: dict[tuple[str, str], list[dict]] = {}
    for holding in request.holdings:
        if holding.asset_type == "fund":
            series = fund_repository.get_raw_nav(holding.code)
        else:
            series = index_repository.get_raw_nav(holding.code)
        if not series:
            raise HTTPException(
                status_code=404,
                detail=f"{holding.asset_type} {holding.code} NAV series not found.",
            )
        series_by_asset[(holding.asset_type, holding.code)] = series

    benchmark_key = None
    if request.benchmark is not None:
        benchmark = request.benchmark
        benchmark_series = (
            fund_repository.get_raw_nav(benchmark.code)
            if benchmark.asset_type == "fund"
            else index_repository.get_raw_nav(benchmark.code)
        )
        if not benchmark_series:
            raise HTTPException(
                status_code=404,
                detail=f"{benchmark.asset_type} {benchmark.code} benchmark series not found.",
            )
        benchmark_key = (benchmark.asset_type, benchmark.code)
        series_by_asset[benchmark_key] = benchmark_series

    try:
        return backtest_portfolio(
            request.holdings,
            series_by_asset,
            rebalance_frequency=request.rebalance_frequency,
            benchmark_key=benchmark_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/watchlist", response_model=list[WatchlistItem])
def get_watchlist(
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> list[WatchlistItem]:
    codes = user_repository.list_watchlist_codes(user_id)
    items: list[WatchlistItem] = []
    for code in codes:
        fund = fund_repository.get_fund(code)
        if fund is None:
            continue
        items.append(
            WatchlistItem(
                code=code,
                name=fund.name,
                fund_type=fund.fund_type,
                manager=fund.manager,
                fund_manager=fund.fund_manager,
                latest_nav=fund.latest_nav,
                latest_nav_date=fund.latest_nav_date,
                asset_size_billion=fund.asset_size_billion,
            )
        )
    return items


@router.post("/watchlist/{code}", response_model=list[WatchlistItem])
def add_watchlist_item(
    code: str,
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> list[WatchlistItem]:
    if fund_repository.get_fund(code) is None:
        raise HTTPException(status_code=404, detail="Fund not found.")
    user_repository.add_watchlist_item(user_id, code)
    return get_watchlist(user_id, user_repository, fund_repository)


@router.delete("/watchlist/{code}", response_model=list[WatchlistItem])
def delete_watchlist_item(
    code: str,
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> list[WatchlistItem]:
    user_repository.remove_watchlist_item(user_id, code)
    return get_watchlist(user_id, user_repository, fund_repository)


@router.get("/compare-lists", response_model=list[CompareList])
def get_compare_lists(
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
) -> list[CompareList]:
    return user_repository.list_compare_lists(user_id)


@router.post("/compare-lists", response_model=CompareList)
def create_compare_list(
    payload: CompareListCreate,
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> CompareList:
    for code in payload.codes:
        if fund_repository.get_fund(code) is None:
            raise HTTPException(status_code=404, detail=f"Fund {code} not found.")
    return user_repository.create_compare_list(user_id, payload)


@router.delete("/compare-lists/{list_id}", response_model=list[CompareList])
def delete_compare_list(
    list_id: str,
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
) -> list[CompareList]:
    user_repository.delete_compare_list(user_id, list_id)
    return user_repository.list_compare_lists(user_id)
