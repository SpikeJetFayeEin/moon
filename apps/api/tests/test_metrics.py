from datetime import date

import pytest

from app.services.metrics import calculate_fund_metrics


def test_calculates_return_drawdown_volatility_sharpe_and_rolling_returns():
    nav_points = [
        {"date": date(2024, 1, 1), "nav": 1.00},
        {"date": date(2024, 1, 2), "nav": 1.10},
        {"date": date(2024, 1, 3), "nav": 1.05},
        {"date": date(2024, 1, 4), "nav": 1.20},
    ]

    metrics = calculate_fund_metrics(nav_points, rolling_windows=(2, 3))

    assert metrics.total_return == pytest.approx(0.20)
    assert metrics.max_drawdown == pytest.approx((1.05 / 1.10) - 1)
    assert metrics.volatility > 0
    assert metrics.sharpe_ratio > 0
    assert metrics.rolling_returns["2"] == pytest.approx([0.10, (1.05 / 1.10) - 1, (1.20 / 1.05) - 1])
    assert metrics.rolling_returns["3"] == pytest.approx([0.05, 0.0909091])


def test_rejects_metric_calculation_when_nav_series_is_too_short():
    with pytest.raises(ValueError, match="at least two NAV points"):
        calculate_fund_metrics([{"date": date(2024, 1, 1), "nav": 1.00}])
