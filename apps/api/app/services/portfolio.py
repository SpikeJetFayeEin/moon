from __future__ import annotations

from math import sqrt
from statistics import mean, pstdev

from app.models.schemas import (
    DrawdownPoint,
    NavPoint,
    PortfolioBacktestResponse,
    PortfolioBenchmark,
    PortfolioContribution,
    PortfolioHolding,
)
from app.services.metrics import TRADING_DAYS_PER_YEAR, calculate_fund_metrics


def backtest_portfolio(
    holdings: list[PortfolioHolding],
    series_by_asset: dict[tuple[str, str], list[dict]],
    rebalance_frequency: str = "none",
    benchmark_key: tuple[str, str] | None = None,
) -> PortfolioBacktestResponse:
    weights = _normalize_weights(holdings)
    common_dates = _common_dates(series_by_asset)
    if len(common_dates) < 2:
        raise ValueError("Portfolio backtest requires at least two common NAV dates.")

    values_by_asset = {
        key: {point["date"]: float(point["nav"]) for point in series}
        for key, series in series_by_asset.items()
    }
    normalized_nav, rebalance_dates = _calculate_portfolio_nav(
        holdings,
        weights,
        common_dates,
        values_by_asset,
        rebalance_frequency,
    )

    metrics = calculate_fund_metrics(normalized_nav)
    metrics.code = "portfolio"
    contributions = []
    first_date = common_dates[0]
    for holding in holdings:
        key = (holding.asset_type, holding.code)
        asset_return = (
            values_by_asset[key][common_dates[-1]] / values_by_asset[key][first_date]
        ) - 1
        contributions.append(
            PortfolioContribution(
                asset_type=holding.asset_type,
                code=holding.code,
                weight=weights[key],
                total_return=asset_return,
                contribution=weights[key] * asset_return,
            )
        )

    return PortfolioBacktestResponse(
        initial_value=1.0,
        nav=[NavPoint(**point) for point in normalized_nav],
        drawdowns=_calculate_drawdowns(normalized_nav),
        metrics=metrics,
        contributions=contributions,
        rebalance_dates=rebalance_dates,
        benchmark=_calculate_benchmark(
            benchmark_key,
            common_dates,
            values_by_asset,
            normalized_nav,
            metrics.total_return,
        ),
    )


def _normalize_weights(holdings: list[PortfolioHolding]) -> dict[tuple[str, str], float]:
    total_weight = sum(holding.weight for holding in holdings)
    return {
        (holding.asset_type, holding.code): holding.weight / total_weight
        for holding in holdings
    }


def _common_dates(series_by_asset: dict[tuple[str, str], list[dict]]) -> list:
    date_sets = [{point["date"] for point in series} for series in series_by_asset.values()]
    if not date_sets:
        return []
    return sorted(set.intersection(*date_sets))


def _calculate_portfolio_nav(
    holdings: list[PortfolioHolding],
    weights: dict[tuple[str, str], float],
    common_dates: list,
    values_by_asset: dict[tuple[str, str], dict],
    rebalance_frequency: str,
) -> tuple[list[dict], list]:
    first_date = common_dates[0]
    units = {
        (holding.asset_type, holding.code): weights[(holding.asset_type, holding.code)]
        / values_by_asset[(holding.asset_type, holding.code)][first_date]
        for holding in holdings
    }
    normalized_nav: list[dict] = []
    rebalance_dates = []
    previous_date = first_date

    for current_date in common_dates:
        value = _portfolio_value(units, values_by_asset, current_date)
        if (
            current_date != first_date
            and _should_rebalance(previous_date, current_date, rebalance_frequency)
        ):
            rebalance_dates.append(current_date)
            units = {
                (holding.asset_type, holding.code): value
                * weights[(holding.asset_type, holding.code)]
                / values_by_asset[(holding.asset_type, holding.code)][current_date]
                for holding in holdings
            }
            value = _portfolio_value(units, values_by_asset, current_date)

        normalized_nav.append(
            {
                "date": current_date,
                "nav": value,
                "accumulated_nav": value,
            }
        )
        previous_date = current_date

    return normalized_nav, rebalance_dates


def _portfolio_value(
    units: dict[tuple[str, str], float],
    values_by_asset: dict[tuple[str, str], dict],
    current_date,
) -> float:
    return sum(units[key] * values_by_asset[key][current_date] for key in units)


def _should_rebalance(previous_date, current_date, frequency: str) -> bool:
    if frequency == "none":
        return False
    if frequency == "monthly":
        return (previous_date.year, previous_date.month) != (
            current_date.year,
            current_date.month,
        )
    if frequency == "quarterly":
        return (previous_date.year, (previous_date.month - 1) // 3) != (
            current_date.year,
            (current_date.month - 1) // 3,
        )
    if frequency == "yearly":
        return previous_date.year != current_date.year
    return False


def _calculate_drawdowns(nav_points: list[dict]) -> list[DrawdownPoint]:
    peak = float(nav_points[0]["nav"])
    drawdowns = []
    for point in nav_points:
        value = float(point["nav"])
        peak = max(peak, value)
        drawdowns.append(DrawdownPoint(date=point["date"], drawdown=(value / peak) - 1))
    return drawdowns


def _calculate_benchmark(
    benchmark_key: tuple[str, str] | None,
    common_dates: list,
    values_by_asset: dict[tuple[str, str], dict],
    portfolio_nav: list[dict],
    portfolio_total_return: float,
) -> PortfolioBenchmark | None:
    if benchmark_key is None or benchmark_key not in values_by_asset:
        return None

    first_date = common_dates[0]
    benchmark_nav = [
        {
            "date": current_date,
            "nav": values_by_asset[benchmark_key][current_date]
            / values_by_asset[benchmark_key][first_date],
            "accumulated_nav": values_by_asset[benchmark_key][current_date]
            / values_by_asset[benchmark_key][first_date],
        }
        for current_date in common_dates
    ]
    benchmark_metrics = calculate_fund_metrics(benchmark_nav)
    benchmark_metrics.code = benchmark_key[1]
    portfolio_returns = _daily_returns([float(point["nav"]) for point in portfolio_nav])
    benchmark_returns = _daily_returns([float(point["nav"]) for point in benchmark_nav])
    active_returns = [
        portfolio_return - benchmark_return
        for portfolio_return, benchmark_return in zip(
            portfolio_returns,
            benchmark_returns,
            strict=False,
        )
    ]
    tracking_error = (
        pstdev(active_returns) * sqrt(TRADING_DAYS_PER_YEAR)
        if len(active_returns) > 1
        else 0.0
    )
    information_ratio = (
        mean(active_returns) / pstdev(active_returns) * sqrt(TRADING_DAYS_PER_YEAR)
        if len(active_returns) > 1 and pstdev(active_returns) > 0
        else 0.0
    )
    return PortfolioBenchmark(
        asset_type=benchmark_key[0],
        code=benchmark_key[1],
        nav=[NavPoint(**point) for point in benchmark_nav],
        metrics=benchmark_metrics,
        excess_return=portfolio_total_return - benchmark_metrics.total_return,
        tracking_error=tracking_error,
        information_ratio=information_ratio,
    )


def _daily_returns(values: list[float]) -> list[float]:
    return [(values[index] / values[index - 1]) - 1 for index in range(1, len(values))]
