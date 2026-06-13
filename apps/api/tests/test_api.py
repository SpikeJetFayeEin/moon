from datetime import date

from fastapi.testclient import TestClient

from app.api.deps import (
    get_fund_repository,
    get_fund_sync_trigger,
    get_index_repository,
    get_index_sync_trigger,
)
from app.main import app
from app.services.sync import IndexSyncResult, SyncResult


client = TestClient(app)


def test_lists_funds_with_search_and_pagination():
    response = client.get("/funds", params={"q": "沪深", "page": 1, "page_size": 5})

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 5
    assert payload["total"] >= 1
    assert payload["items"][0]["code"] == "000300"


def test_fund_list_items_include_risk_return_summary():
    response = client.get("/funds", params={"q": "沪深", "page": 1, "page_size": 5})

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["return_1m"] is not None
    assert item["drawdown_1m"] is not None
    assert "return_1y" in item
    assert "drawdown_1y" in item
    assert item["max_drawdown"] is not None
    assert item["volatility"] is not None
    assert item["sharpe_ratio"] is not None


def test_readiness_reports_deployment_configuration():
    response = client.get("/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["checks"]["supabase_database"] is False
    assert payload["checks"]["supabase_auth_jwt"] is False
    assert payload["checks"]["akshare_sync"] is False
    assert "SUPABASE_URL" in payload["missing_env"]
    assert "API_CORS_ORIGINS" in payload["configured_env"]


def test_returns_fund_metrics_for_detail_page():
    response = client.get("/funds/000300/metrics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == "000300"
    assert payload["total_return"] > 0
    assert "60" in payload["rolling_returns"]


def test_returns_fund_drawdown_series_for_detail_page():
    response = client.get("/funds/000300/drawdowns")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == "000300"
    assert len(payload["items"]) >= 2
    assert payload["items"][0]["drawdown"] == 0
    assert min(item["drawdown"] for item in payload["items"]) <= 0


def test_returns_fund_profile_for_detail_page():
    response = client.get("/funds/000300/profile")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == "000300"
    assert payload["name"] == "沪深300指数增强"
    assert payload["fund_company"] == "华夏基金"
    assert "benchmark" in payload


def test_returns_fund_performance_for_detail_page():
    response = client.get("/funds/000300/performance")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == "000300"
    assert isinstance(payload["items"], list)


def test_returns_holding_analysis_for_selected_range_and_holding_days():
    response = client.get(
        "/funds/000300/metrics",
        params={"holding_days": 10},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["holding_analysis"]["holding_days"] == 10
    assert payload["holding_analysis"]["sample_count"] > 0
    assert 0 <= payload["holding_analysis"]["win_rate"] <= 1


def test_lists_total_return_indices():
    response = client.get("/indices")

    assert response.status_code == 200
    payload = response.json()
    assert [item["code"] for item in payload["items"]] == ["ndx", "spx"]
    assert payload["items"][0]["return_type"] == "total_return"


def test_returns_total_return_index_nav_and_metrics():
    nav_response = client.get("/indices/ndx/nav")
    metrics_response = client.get(
        "/indices/ndx/metrics",
        params={"holding_days": 30, "start_date": "2020-01-01"},
    )

    assert nav_response.status_code == 200
    nav_payload = nav_response.json()
    assert nav_payload["code"] == "ndx"
    assert len(nav_payload["items"]) >= 2
    assert nav_payload["items"][0]["nav"] == 1

    assert metrics_response.status_code == 200
    metrics_payload = metrics_response.json()
    assert metrics_payload["code"] == "ndx"
    assert metrics_payload["holding_analysis"]["holding_days"] == 30
    assert metrics_payload["holding_analysis"]["sample_count"] > 0


def test_returns_total_return_index_drawdown_series():
    response = client.get("/indices/ndx/drawdowns")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == "ndx"
    assert len(payload["items"]) >= 2
    assert payload["items"][0]["drawdown"] == 0
    assert min(item["drawdown"] for item in payload["items"]) <= 0


def test_legacy_compare_portfolio_and_watchlist_routes_are_removed():
    assert client.post("/compare", json={"codes": ["000300", "110022"]}).status_code == 404
    assert client.post("/portfolio/backtest", json={}).status_code == 404
    assert client.get("/watchlist").status_code == 404
    assert client.get("/compare-lists").status_code == 404


def test_syncs_one_selected_fund_from_page_action():
    synced_codes: list[str] = []

    def sync_trigger(fund):
        synced_codes.append(fund.code)
        return SyncResult(funds_seen=1, nav_rows_seen=2, synced_at=date(2026, 6, 13))

    app.dependency_overrides[get_fund_sync_trigger] = lambda: sync_trigger
    try:
        response = client.post("/funds/000300/sync")
    finally:
        app.dependency_overrides.pop(get_fund_sync_trigger, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "asset_type": "fund",
        "code": "000300",
        "items_seen": 1,
        "nav_rows_seen": 2,
        "synced_at": "2026-06-13",
        "status": "synced",
    }
    assert synced_codes == ["000300"]


def test_syncs_unknown_fund_code_from_search_action():
    synced: list[tuple[str, str]] = []

    def sync_trigger(fund):
        synced.append((fund.code, fund.name))
        return SyncResult(funds_seen=1, nav_rows_seen=5, synced_at=date(2026, 6, 13))

    app.dependency_overrides[get_fund_sync_trigger] = lambda: sync_trigger
    try:
        response = client.post("/funds/999999/sync")
    finally:
        app.dependency_overrides.pop(get_fund_sync_trigger, None)

    assert response.status_code == 200
    assert response.json()["status"] == "synced"
    assert synced == [("999999", "待同步基金 999999")]


def test_deletes_selected_synced_fund_from_page_action():
    deleted_codes: list[str] = []

    class FakeFundRepository:
        def delete_fund(self, code: str) -> bool:
            deleted_codes.append(code)
            return True

    app.dependency_overrides[get_fund_repository] = lambda: FakeFundRepository()
    try:
        response = client.delete("/funds/000300/sync")
    finally:
        app.dependency_overrides.pop(get_fund_repository, None)

    assert response.status_code == 200
    assert response.json() == {
        "asset_type": "fund",
        "code": "000300",
        "deleted": True,
        "status": "deleted",
    }
    assert deleted_codes == ["000300"]


def test_syncs_one_selected_index_from_page_action():
    synced_codes: list[str] = []

    def sync_trigger(market_index):
        synced_codes.append(market_index.code)
        return IndexSyncResult(
            indices_seen=1,
            nav_rows_seen=3,
            synced_at=date(2026, 6, 13),
        )

    app.dependency_overrides[get_index_sync_trigger] = lambda: sync_trigger
    try:
        response = client.post("/indices/ndx/sync")
    finally:
        app.dependency_overrides.pop(get_index_sync_trigger, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "asset_type": "index",
        "code": "ndx",
        "items_seen": 1,
        "nav_rows_seen": 3,
        "synced_at": "2026-06-13",
        "status": "synced",
    }
    assert synced_codes == ["ndx"]


def test_syncs_unknown_index_code_from_search_action():
    synced: list[tuple[str, str]] = []

    def sync_trigger(market_index):
        synced.append((market_index.code, market_index.symbol))
        return IndexSyncResult(indices_seen=1, nav_rows_seen=8, synced_at=date(2026, 6, 13))

    app.dependency_overrides[get_index_sync_trigger] = lambda: sync_trigger
    try:
        response = client.post("/indices/qqq/sync")
    finally:
        app.dependency_overrides.pop(get_index_sync_trigger, None)

    assert response.status_code == 200
    assert response.json()["status"] == "synced"
    assert synced == [("qqq", "QQQ")]


def test_deletes_selected_synced_index_from_page_action():
    deleted_codes: list[str] = []

    class FakeIndexRepository:
        def delete_index(self, code: str) -> bool:
            deleted_codes.append(code)
            return True

    app.dependency_overrides[get_index_repository] = lambda: FakeIndexRepository()
    try:
        response = client.delete("/indices/ndx/sync")
    finally:
        app.dependency_overrides.pop(get_index_repository, None)

    assert response.status_code == 200
    assert response.json() == {
        "asset_type": "index",
        "code": "ndx",
        "deleted": True,
        "status": "deleted",
    }
    assert deleted_codes == ["ndx"]
