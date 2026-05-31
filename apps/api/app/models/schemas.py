from datetime import UTC, date, datetime
from pydantic import BaseModel, Field


class Fund(BaseModel):
    code: str
    name: str
    fund_type: str
    manager: str
    inception_date: date
    latest_nav: float
    latest_nav_date: date
    asset_size_billion: float


class FundListResponse(BaseModel):
    items: list[Fund]
    total: int
    page: int
    page_size: int


class NavPoint(BaseModel):
    date: date
    nav: float
    accumulated_nav: float | None = None


class FundMetrics(BaseModel):
    code: str
    total_return: float
    annualized_return: float
    max_drawdown: float
    volatility: float
    sharpe_ratio: float
    rolling_returns: dict[str, list[float]]
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CompareRequest(BaseModel):
    codes: list[str] = Field(min_length=2, max_length=8)


class CompareItem(BaseModel):
    code: str
    name: str
    total_return: float
    max_drawdown: float
    volatility: float
    sharpe_ratio: float
    nav: list[NavPoint]


class CompareResponse(BaseModel):
    items: list[CompareItem]


class WatchlistItem(BaseModel):
    code: str
    name: str


class CompareListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    codes: list[str] = Field(min_length=2, max_length=8)


class CompareList(CompareListCreate):
    id: str
    created_at: datetime
