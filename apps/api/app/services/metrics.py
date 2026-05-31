from __future__ import annotations

from math import sqrt
from statistics import mean, pstdev
from typing import Iterable

from app.models.schemas import FundMetrics


TRADING_DAYS_PER_YEAR = 252


def calculate_fund_metrics(
    nav_points: Iterable[dict],
    rolling_windows: tuple[int, ...] = (20, 60, 120),
    risk_free_rate: float = 0.02,
) -> FundMetrics:
    points = sorted(nav_points, key=lambda item: item["date"])
    if len(points) < 2:
        raise ValueError("Metric calculation requires at least two NAV points.")

    values = [float(point["nav"]) for point in points]
    daily_returns = [
        (values[index] / values[index - 1]) - 1 for index in range(1, len(values))
    ]

    total_return = (values[-1] / values[0]) - 1
    annualized_return = (1 + total_return) ** (
        TRADING_DAYS_PER_YEAR / max(len(daily_returns), 1)
    ) - 1
    max_drawdown = _calculate_max_drawdown(values)
    volatility = pstdev(daily_returns) * sqrt(TRADING_DAYS_PER_YEAR)
    excess_daily_return = mean(daily_returns) - risk_free_rate / TRADING_DAYS_PER_YEAR
    sharpe_ratio = (
        excess_daily_return / pstdev(daily_returns) * sqrt(TRADING_DAYS_PER_YEAR)
        if len(daily_returns) > 1 and pstdev(daily_returns) > 0
        else 0.0
    )
    rolling_returns = {
        str(window): _calculate_rolling_returns(values, window)
        for window in rolling_windows
        if window <= len(values)
    }

    return FundMetrics(
        code=str(points[0].get("code", "")),
        total_return=total_return,
        annualized_return=annualized_return,
        max_drawdown=max_drawdown,
        volatility=volatility,
        sharpe_ratio=sharpe_ratio,
        rolling_returns=rolling_returns,
    )


def _calculate_max_drawdown(values: list[float]) -> float:
    peak = values[0]
    worst = 0.0
    for value in values:
        peak = max(peak, value)
        drawdown = (value / peak) - 1
        worst = min(worst, drawdown)
    return worst


def _calculate_rolling_returns(values: list[float], window: int) -> list[float]:
    if window < 2:
        raise ValueError("Rolling window must be at least 2.")
    return [
        (values[index + window - 1] / values[index]) - 1
        for index in range(0, len(values) - window + 1)
    ]
