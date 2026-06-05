from datetime import UTC, date, datetime
from pydantic import BaseModel, Field


class Fund(BaseModel):
    code: str
    name: str
    fund_type: str
    manager: str
    fund_manager: str | None = None
    inception_date: date
    latest_nav: float | None = None
    latest_nav_date: date | None = None
    asset_size_billion: float | None = None
    return_1m: float | None = None
    drawdown_1m: float | None = None
    return_1y: float | None = None
    drawdown_1y: float | None = None
    max_drawdown: float | None = None
    volatility: float | None = None
    sharpe_ratio: float | None = None


class FundProfile(BaseModel):
    code: str
    name: str
    full_name: str | None = None
    fund_company: str | None = None
    fund_manager: str | None = None
    custodian: str | None = None
    fund_type: str | None = None
    inception_date: date | None = None
    asset_size_billion: float | None = None
    rating_source: str | None = None
    rating: str | None = None
    investment_strategy: str | None = None
    investment_target: str | None = None
    benchmark: str | None = None


class FundPerformanceItem(BaseModel):
    performance_type: str
    period: str
    return_rate: float | None = None
    max_drawdown: float | None = None
    rank: str | None = None


class FundPerformanceResponse(BaseModel):
    code: str
    items: list[FundPerformanceItem]


class FundListResponse(BaseModel):
    items: list[Fund]
    total: int
    page: int
    page_size: int


class MarketIndex(BaseModel):
    code: str
    name: str
    symbol: str
    return_type: str
    currency: str
    provider: str
    description: str
    latest_value: float
    latest_date: date


class MarketIndexListResponse(BaseModel):
    items: list[MarketIndex]


class ReadinessResponse(BaseModel):
    status: str
    checks: dict[str, bool]
    configured_env: list[str]
    missing_env: list[str]


class NavPoint(BaseModel):
    date: date
    nav: float
    accumulated_nav: float | None = None


class DrawdownPoint(BaseModel):
    date: date
    drawdown: float


class DrawdownSeriesResponse(BaseModel):
    code: str
    items: list[DrawdownPoint]


class HoldingAnalysis(BaseModel):
    holding_days: int
    sample_count: int
    win_rate: float
    average_return: float
    median_return: float
    best_return: float
    worst_return: float


class FundMetrics(BaseModel):
    code: str
    total_return: float
    annualized_return: float
    max_drawdown: float
    volatility: float
    sharpe_ratio: float
    downside_volatility: float
    sortino_ratio: float
    calmar_ratio: float
    positive_day_rate: float
    best_daily_return: float
    worst_daily_return: float
    value_at_risk_95: float
    conditional_value_at_risk_95: float
    period_returns: dict[str, float | None]
    period_drawdowns: dict[str, float | None]
    yearly_returns: dict[str, float]
    rolling_returns: dict[str, list[float]]
    holding_analysis: HoldingAnalysis
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


class PortfolioHolding(BaseModel):
    asset_type: str = Field(pattern="^(fund|index)$")
    code: str
    weight: float = Field(gt=0)


class PortfolioBacktestRequest(BaseModel):
    holdings: list[PortfolioHolding] = Field(min_length=2, max_length=12)
    rebalance_frequency: str = Field(default="none", pattern="^(none|monthly|quarterly|yearly)$")
    benchmark: PortfolioHolding | None = None


class PortfolioContribution(BaseModel):
    asset_type: str
    code: str
    weight: float
    total_return: float
    contribution: float


class PortfolioBenchmark(BaseModel):
    asset_type: str
    code: str
    nav: list[NavPoint]
    metrics: FundMetrics
    excess_return: float
    tracking_error: float
    information_ratio: float


class PortfolioBacktestResponse(BaseModel):
    initial_value: float
    nav: list[NavPoint]
    drawdowns: list[DrawdownPoint]
    metrics: FundMetrics
    contributions: list[PortfolioContribution]
    rebalance_dates: list[date]
    benchmark: PortfolioBenchmark | None = None


class WatchlistItem(BaseModel):
    code: str
    name: str
    fund_type: str | None = None
    manager: str | None = None
    fund_manager: str | None = None
    latest_nav: float | None = None
    latest_nav_date: date | None = None
    asset_size_billion: float | None = None
    return_1m: float | None = None
    drawdown_1m: float | None = None
    return_1y: float | None = None
    drawdown_1y: float | None = None
    max_drawdown: float | None = None
    volatility: float | None = None
    sharpe_ratio: float | None = None


class CompareListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    codes: list[str] = Field(min_length=2, max_length=8)


class CompareList(CompareListCreate):
    id: str
    created_at: datetime
