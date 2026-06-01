from __future__ import annotations

from app.models.schemas import (
    NavPoint,
    PortfolioBacktestResponse,
    PortfolioContribution,
    PortfolioHolding,
)
from app.services.metrics import calculate_fund_metrics


def backtest_portfolio(
    holdings: list[PortfolioHolding],
    series_by_asset: dict[tuple[str, str], list[dict]],
) -> PortfolioBacktestResponse:
    weights = _normalize_weights(holdings)
    common_dates = _common_dates(series_by_asset)
    if len(common_dates) < 2:
        raise ValueError("Portfolio backtest requires at least two common NAV dates.")

    values_by_asset = {
        key: {point["date"]: float(point["nav"]) for point in series}
        for key, series in series_by_asset.items()
    }
    first_date = common_dates[0]
    normalized_nav: list[dict] = []
    for current_date in common_dates:
        value = 0.0
        for holding in holdings:
            key = (holding.asset_type, holding.code)
            first_value = values_by_asset[key][first_date]
            current_value = values_by_asset[key][current_date]
            value += weights[key] * (current_value / first_value)
        normalized_nav.append(
            {
                "date": current_date,
                "nav": value,
                "accumulated_nav": value,
            }
        )

    metrics = calculate_fund_metrics(normalized_nav)
    metrics.code = "portfolio"
    contributions = []
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
        metrics=metrics,
        contributions=contributions,
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
