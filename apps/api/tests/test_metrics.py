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


def test_calculates_holding_win_rate_and_returns_by_calendar_days():
    nav_points = [
        {"date": date(2024, 1, 1), "nav": 1.00},
        {"date": date(2024, 1, 2), "nav": 1.10},
        {"date": date(2024, 1, 3), "nav": 1.05},
        {"date": date(2024, 1, 4), "nav": 1.20},
    ]

    metrics = calculate_fund_metrics(nav_points, holding_days=2)

    assert metrics.holding_analysis.holding_days == 2
    assert metrics.holding_analysis.sample_count == 2
    assert metrics.holding_analysis.win_rate == pytest.approx(1.0)
    assert metrics.holding_analysis.average_return == pytest.approx(
        ((1.05 / 1.00) - 1 + (1.20 / 1.10) - 1) / 2
    )
    assert metrics.holding_analysis.median_return == pytest.approx(
        ((1.05 / 1.00) - 1 + (1.20 / 1.10) - 1) / 2
    )
    assert metrics.holding_analysis.best_return == pytest.approx((1.20 / 1.10) - 1)
    assert metrics.holding_analysis.worst_return == pytest.approx(0.05)


def test_prefers_accumulated_nav_for_adjusted_return_metrics():
    nav_points = [
        {"date": date(2024, 1, 1), "nav": 1.00, "accumulated_nav": 1.00},
        {"date": date(2024, 1, 2), "nav": 0.90, "accumulated_nav": 1.10},
        {"date": date(2024, 1, 3), "nav": 0.95, "accumulated_nav": 1.20},
    ]

    metrics = calculate_fund_metrics(nav_points, rolling_windows=(2,), holding_days=1)

    assert metrics.total_return == pytest.approx(0.20)
    assert metrics.max_drawdown == pytest.approx(0.0)
    assert metrics.rolling_returns["2"] == pytest.approx([0.10, (1.20 / 1.10) - 1])
    assert metrics.yearly_returns["2024"] == pytest.approx(0.20)
    assert metrics.holding_analysis.average_return == pytest.approx(
        ((1.10 / 1.00) - 1 + (1.20 / 1.10) - 1) / 2
    )


def test_default_rolling_windows_include_half_year_and_one_year():
    nav_points = [
        {"date": date(2024, 1, day), "nav": 1 + day / 1000}
        for day in range(1, 29)
    ] + [
        {"date": date(2024, month, day), "nav": 1 + (month * 31 + day) / 1000}
        for month in range(2, 11)
        for day in range(1, 29)
    ]

    metrics = calculate_fund_metrics(nav_points)

    assert "180" in metrics.rolling_returns
    assert "252" in metrics.rolling_returns


def test_calculates_advanced_risk_and_calendar_metrics():
    nav_points = [
        {"date": date(2024, 1, 1), "nav": 1.00},
        {"date": date(2024, 1, 2), "nav": 1.10},
        {"date": date(2024, 1, 3), "nav": 1.00},
        {"date": date(2024, 1, 4), "nav": 1.20},
        {"date": date(2024, 1, 5), "nav": 1.15},
    ]

    metrics = calculate_fund_metrics(nav_points, rolling_windows=(2,))

    assert metrics.positive_day_rate == pytest.approx(0.5)
    assert metrics.best_daily_return == pytest.approx(0.2)
    assert metrics.worst_daily_return == pytest.approx((1.00 / 1.10) - 1)
    assert metrics.downside_volatility > 0
    assert metrics.sortino_ratio > metrics.sharpe_ratio
    assert metrics.calmar_ratio == pytest.approx(
        metrics.annualized_return / abs(metrics.max_drawdown)
    )
    assert metrics.value_at_risk_95 == pytest.approx((1.00 / 1.10) - 1)
    assert metrics.conditional_value_at_risk_95 == pytest.approx((1.00 / 1.10) - 1)
    assert metrics.yearly_returns["2024"] == pytest.approx(0.15)


def test_filters_metric_calculation_by_date_range():
    nav_points = [
        {"date": date(2024, 1, 1), "nav": 1.00},
        {"date": date(2024, 1, 2), "nav": 1.10},
        {"date": date(2024, 1, 3), "nav": 1.05},
        {"date": date(2024, 1, 4), "nav": 1.20},
    ]

    metrics = calculate_fund_metrics(
        nav_points,
        start_date=date(2024, 1, 2),
        end_date=date(2024, 1, 4),
        holding_days=2,
    )

    assert metrics.total_return == pytest.approx((1.20 / 1.10) - 1)
    assert metrics.holding_analysis.sample_count == 1
    assert metrics.holding_analysis.average_return == pytest.approx((1.20 / 1.10) - 1)


def test_rejects_metric_calculation_when_nav_series_is_too_short():
    with pytest.raises(ValueError, match="at least two NAV points"):
        calculate_fund_metrics([{"date": date(2024, 1, 1), "nav": 1.00}])
