from __future__ import annotations

from datetime import date, timedelta
from math import sqrt
from statistics import mean, median, pstdev
from typing import Iterable

from app.models.schemas import FundMetrics, HoldingAnalysis


TRADING_DAYS_PER_YEAR = 252


def calculate_fund_metrics(
    nav_points: Iterable[dict],
    rolling_windows: tuple[int, ...] = (20, 60, 120, 180, 252),
    risk_free_rate: float = 0.02,
    holding_days: int = 30,
    start_date: date | None = None,
    end_date: date | None = None,
) -> FundMetrics:
    points = _filter_points_by_date(
        sorted(nav_points, key=lambda item: _point_date(item)),
        start_date,
        end_date,
    )
    if len(points) < 2:
        raise ValueError("Metric calculation requires at least two NAV points.")

    values = [_point_value(point) for point in points]
    daily_returns = [
        (values[index] / values[index - 1]) - 1 for index in range(1, len(values))
    ]

    total_return = (values[-1] / values[0]) - 1
    annualized_return = (1 + total_return) ** (
        TRADING_DAYS_PER_YEAR / max(len(daily_returns), 1)
    ) - 1
    max_drawdown = _calculate_max_drawdown(values)
    volatility = pstdev(daily_returns) * sqrt(TRADING_DAYS_PER_YEAR)
    downside_returns = [value for value in daily_returns if value < 0]
    downside_deviation = (
        sqrt(mean([value**2 for value in downside_returns])) * sqrt(TRADING_DAYS_PER_YEAR)
        if downside_returns
        else 0.0
    )
    excess_daily_return = mean(daily_returns) - risk_free_rate / TRADING_DAYS_PER_YEAR
    sharpe_ratio = (
        excess_daily_return / pstdev(daily_returns) * sqrt(TRADING_DAYS_PER_YEAR)
        if len(daily_returns) > 1 and pstdev(daily_returns) > 0
        else 0.0
    )
    sortino_ratio = (
        excess_daily_return / downside_deviation * TRADING_DAYS_PER_YEAR
        if downside_deviation > 0
        else 0.0
    )
    calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown < 0 else 0.0
    rolling_returns = {
        str(window): _calculate_rolling_returns(values, window)
        for window in rolling_windows
        if window <= len(values)
    }
    holding_analysis = _calculate_holding_analysis(points, max(holding_days, 1))

    return FundMetrics(
        code=str(points[0].get("code", "")),
        total_return=total_return,
        annualized_return=annualized_return,
        max_drawdown=max_drawdown,
        volatility=volatility,
        sharpe_ratio=sharpe_ratio,
        downside_volatility=downside_deviation,
        sortino_ratio=sortino_ratio,
        calmar_ratio=calmar_ratio,
        positive_day_rate=sum(1 for value in daily_returns if value > 0) / len(daily_returns),
        best_daily_return=max(daily_returns),
        worst_daily_return=min(daily_returns),
        value_at_risk_95=_calculate_historical_var(daily_returns, 0.95),
        conditional_value_at_risk_95=_calculate_conditional_var(daily_returns, 0.95),
        period_returns=_calculate_period_returns(points),
        period_drawdowns=_calculate_period_drawdowns(points),
        yearly_returns=_calculate_yearly_returns(points),
        rolling_returns=rolling_returns,
        holding_analysis=holding_analysis,
    )


def _filter_points_by_date(
    points: list[dict],
    start_date: date | None,
    end_date: date | None,
) -> list[dict]:
    return [
        point
        for point in points
        if (start_date is None or _point_date(point) >= start_date)
        and (end_date is None or _point_date(point) <= end_date)
    ]


def _point_date(point: dict) -> date:
    value = point["date"]
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _point_value(point: dict) -> float:
    return float(point.get("accumulated_nav") or point["nav"])


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


def _calculate_historical_var(returns: list[float], confidence: float) -> float:
    sorted_returns = sorted(returns)
    index = int((1 - confidence) * (len(sorted_returns) - 1))
    return sorted_returns[max(index, 0)]


def _calculate_conditional_var(returns: list[float], confidence: float) -> float:
    value_at_risk = _calculate_historical_var(returns, confidence)
    tail_returns = [value for value in returns if value <= value_at_risk]
    return mean(tail_returns) if tail_returns else value_at_risk


def _calculate_yearly_returns(points: list[dict]) -> dict[str, float]:
    years: dict[int, list[dict]] = {}
    for point in points:
        years.setdefault(_point_date(point).year, []).append(point)
    return {
        str(year): (_point_value(year_points[-1]) / _point_value(year_points[0])) - 1
        for year, year_points in sorted(years.items())
        if len(year_points) >= 2
    }


def _calculate_period_returns(points: list[dict]) -> dict[str, float | None]:
    end_point = points[-1]
    end_date = _point_date(end_point)
    return {
        "1w": _calculate_trailing_period_return(points, end_date, 7),
        "1m": _calculate_trailing_period_return(points, end_date, 30),
        "3m": _calculate_trailing_period_return(points, end_date, 90),
        "6m": _calculate_trailing_period_return(points, end_date, 180),
        "1y": _calculate_trailing_period_return(points, end_date, 365),
        "3y": _calculate_trailing_period_return(points, end_date, 365 * 3),
        "5y": _calculate_trailing_period_return(points, end_date, 365 * 5),
        "ytd": _calculate_year_to_date_return(points, end_date),
        "since_inception": (_point_value(end_point) / _point_value(points[0])) - 1,
    }


def _calculate_trailing_period_return(
    points: list[dict],
    end_date: date,
    days: int,
) -> float | None:
    target_date = end_date - timedelta(days=days)
    if _point_date(points[0]) > target_date:
        return None
    start_point = _closest_point_to_date(points, target_date)
    if start_point is None:
        return None
    return (_point_value(points[-1]) / _point_value(start_point)) - 1


def _calculate_year_to_date_return(points: list[dict], end_date: date) -> float | None:
    year_start_index = next(
        (
            index
            for index, point in enumerate(points)
            if _point_date(point).year == end_date.year
        ),
        None,
    )
    if year_start_index is None:
        return None
    start_point = points[year_start_index - 1] if year_start_index > 0 else points[year_start_index]
    return (_point_value(points[-1]) / _point_value(start_point)) - 1


def _calculate_period_drawdowns(points: list[dict]) -> dict[str, float | None]:
    end_date = _point_date(points[-1])
    return {
        "1w": _calculate_trailing_period_drawdown(points, end_date, 7),
        "1m": _calculate_trailing_period_drawdown(points, end_date, 30),
        "3m": _calculate_trailing_period_drawdown(points, end_date, 90),
        "6m": _calculate_trailing_period_drawdown(points, end_date, 180),
        "1y": _calculate_trailing_period_drawdown(points, end_date, 365),
        "3y": _calculate_trailing_period_drawdown(points, end_date, 365 * 3),
        "5y": _calculate_trailing_period_drawdown(points, end_date, 365 * 5),
        "ytd": _calculate_year_to_date_drawdown(points, end_date),
        "since_inception": _calculate_max_drawdown([_point_value(point) for point in points]),
    }


def _calculate_trailing_period_drawdown(
    points: list[dict],
    end_date: date,
    days: int,
) -> float | None:
    target_date = end_date - timedelta(days=days)
    if _point_date(points[0]) > target_date:
        return None
    start_index = _closest_point_index_to_date(points, target_date)
    if start_index is None:
        return None
    return _calculate_max_drawdown([_point_value(point) for point in points[start_index:]])


def _calculate_year_to_date_drawdown(points: list[dict], end_date: date) -> float | None:
    year_start_index = next(
        (
            index
            for index, point in enumerate(points)
            if _point_date(point).year == end_date.year
        ),
        None,
    )
    if year_start_index is None:
        return None
    start_index = max(year_start_index - 1, 0)
    return _calculate_max_drawdown([_point_value(point) for point in points[start_index:]])


def _calculate_holding_analysis(points: list[dict], holding_days: int) -> HoldingAnalysis:
    holding_returns: list[float] = []
    for start_index, start_point in enumerate(points):
        target_date = _point_date(start_point) + timedelta(days=holding_days)
        exit_point = _first_point_on_or_after(points[start_index + 1 :], target_date)
        if exit_point is None:
            continue
        holding_returns.append((_point_value(exit_point) / _point_value(start_point)) - 1)

    if not holding_returns:
        return HoldingAnalysis(
            holding_days=holding_days,
            sample_count=0,
            win_rate=0,
            average_return=0,
            median_return=0,
            best_return=0,
            worst_return=0,
        )

    return HoldingAnalysis(
        holding_days=holding_days,
        sample_count=len(holding_returns),
        win_rate=sum(1 for value in holding_returns if value > 0) / len(holding_returns),
        average_return=mean(holding_returns),
        median_return=median(holding_returns),
        best_return=max(holding_returns),
        worst_return=min(holding_returns),
    )


def _first_point_on_or_after(points: list[dict], target_date: date) -> dict | None:
    for point in points:
        if _point_date(point) >= target_date:
            return point
    return None


def _closest_point_to_date(points: list[dict], target_date: date) -> dict | None:
    if not points:
        return None
    index = _closest_point_index_to_date(points, target_date)
    return points[index] if index is not None else None


def _closest_point_index_to_date(points: list[dict], target_date: date) -> int | None:
    if not points:
        return None
    return min(
        range(len(points)),
        key=lambda index: abs((_point_date(points[index]) - target_date).days),
    )
