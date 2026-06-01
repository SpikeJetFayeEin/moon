from datetime import date

import pytest

from app.models.schemas import PortfolioHolding
from app.services.portfolio import backtest_portfolio


def test_monthly_rebalancing_changes_portfolio_path_when_assets_drift():
    holdings = [
        PortfolioHolding(asset_type="fund", code="a", weight=0.5),
        PortfolioHolding(asset_type="fund", code="b", weight=0.5),
    ]
    series_by_asset = {
        ("fund", "a"): [
            {"date": date(2024, 1, 1), "nav": 1.0},
            {"date": date(2024, 1, 31), "nav": 2.0},
            {"date": date(2024, 2, 1), "nav": 2.0},
            {"date": date(2024, 2, 29), "nav": 2.0},
        ],
        ("fund", "b"): [
            {"date": date(2024, 1, 1), "nav": 1.0},
            {"date": date(2024, 1, 31), "nav": 1.0},
            {"date": date(2024, 2, 1), "nav": 1.0},
            {"date": date(2024, 2, 29), "nav": 2.0},
        ],
    }

    buy_and_hold = backtest_portfolio(holdings, series_by_asset, rebalance_frequency="none")
    monthly = backtest_portfolio(holdings, series_by_asset, rebalance_frequency="monthly")

    assert buy_and_hold.nav[-1].nav == pytest.approx(2.0)
    assert monthly.nav[-1].nav == pytest.approx(2.25)
    assert monthly.rebalance_dates == [date(2024, 2, 1)]


def test_backtest_returns_drawdown_series_and_benchmark_comparison():
    holdings = [
        PortfolioHolding(asset_type="fund", code="a", weight=0.5),
        PortfolioHolding(asset_type="fund", code="b", weight=0.5),
    ]
    series_by_asset = {
        ("fund", "a"): [
            {"date": date(2024, 1, 1), "nav": 1.0},
            {"date": date(2024, 1, 2), "nav": 1.2},
            {"date": date(2024, 1, 3), "nav": 1.1},
        ],
        ("fund", "b"): [
            {"date": date(2024, 1, 1), "nav": 1.0},
            {"date": date(2024, 1, 2), "nav": 1.0},
            {"date": date(2024, 1, 3), "nav": 1.0},
        ],
        ("index", "spx"): [
            {"date": date(2024, 1, 1), "nav": 1.0},
            {"date": date(2024, 1, 2), "nav": 1.05},
            {"date": date(2024, 1, 3), "nav": 1.08},
        ],
    }

    result = backtest_portfolio(
        holdings,
        series_by_asset,
        benchmark_key=("index", "spx"),
    )

    assert result.drawdowns[-1].drawdown < 0
    assert result.benchmark is not None
    assert result.benchmark.code == "spx"
    assert result.benchmark.excess_return == pytest.approx(
        result.metrics.total_return - result.benchmark.metrics.total_return
    )
