from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_fund_repository, get_user_repository, require_user_id
from app.models.schemas import (
    CompareItem,
    CompareList,
    CompareListCreate,
    CompareRequest,
    CompareResponse,
    FundListResponse,
    FundMetrics,
    WatchlistItem,
)
from app.repositories.funds import FundRepository
from app.repositories.users import UserRepository
from app.services.metrics import calculate_fund_metrics


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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


@router.get("/funds/{code}/nav")
def get_nav(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
):
    nav = fund_repository.get_nav(code)
    if not nav:
        raise HTTPException(status_code=404, detail="NAV series not found.")
    return {"code": code, "items": nav}


@router.get("/funds/{code}/metrics", response_model=FundMetrics)
def get_metrics(
    code: str,
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> FundMetrics:
    raw_nav = fund_repository.get_raw_nav(code)
    if not raw_nav:
        raise HTTPException(status_code=404, detail="NAV series not found.")
    metrics = calculate_fund_metrics(raw_nav)
    metrics.code = code
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
        metrics = get_metrics(code, fund_repository)
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


@router.get("/watchlist", response_model=list[WatchlistItem])
def get_watchlist(
    user_id: str = Depends(require_user_id),
    user_repository: UserRepository = Depends(get_user_repository),
    fund_repository: FundRepository = Depends(get_fund_repository),
) -> list[WatchlistItem]:
    codes = user_repository.list_watchlist_codes(user_id)
    return [
        WatchlistItem(code=code, name=fund_repository.get_fund(code).name)
        for code in codes
        if fund_repository.get_fund(code) is not None
    ]


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
