from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_lists_funds_with_search_and_pagination():
    response = client.get("/funds", params={"q": "沪深", "page": 1, "page_size": 5})

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 5
    assert payload["total"] >= 1
    assert payload["items"][0]["code"] == "000300"


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


def test_compares_multiple_funds():
    response = client.post("/compare", json={"codes": ["000300", "110022"]})

    assert response.status_code == 200
    payload = response.json()
    assert [item["code"] for item in payload["items"]] == ["000300", "110022"]


def test_backtests_weighted_portfolio():
    response = client.post(
        "/portfolio/backtest",
        json={
            "rebalance_frequency": "monthly",
            "benchmark": {"asset_type": "index", "code": "spx", "weight": 1},
            "holdings": [
                {"asset_type": "fund", "code": "000300", "weight": 0.6},
                {"asset_type": "fund", "code": "110022", "weight": 0.4},
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["initial_value"] == 1
    assert len(payload["nav"]) >= 2
    assert payload["nav"][0]["nav"] == 1
    assert len(payload["drawdowns"]) == len(payload["nav"])
    assert payload["metrics"]["total_return"] != 0
    assert payload["contributions"][0]["code"] == "000300"
    assert payload["benchmark"]["code"] == "spx"


def test_watchlist_requires_authentication():
    response = client.get("/watchlist")

    assert response.status_code == 401


def test_authenticated_user_can_manage_watchlist():
    headers = {"Authorization": "Bearer api-user-watchlist"}

    add_response = client.post("/watchlist/000300", headers=headers)
    assert add_response.status_code == 200
    watchlist_item = add_response.json()[0]
    assert watchlist_item["code"] == "000300"
    assert watchlist_item["name"] == "沪深300指数增强"
    assert watchlist_item["fund_type"] == "指数增强"
    assert watchlist_item["manager"] == "华夏基金"
    assert watchlist_item["latest_nav"] is not None
    assert watchlist_item["latest_nav_date"] is not None
    assert watchlist_item["asset_size_billion"] == 86.4

    delete_response = client.delete("/watchlist/000300", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json() == []


def test_authenticated_user_can_save_and_delete_compare_list():
    headers = {"Authorization": "Bearer api-user-compare"}

    create_response = client.post(
        "/compare-lists",
        headers=headers,
        json={"name": "宽基与消费", "codes": ["000300", "110022"]},
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == "宽基与消费"
    assert created["codes"] == ["000300", "110022"]

    list_response = client.get("/compare-lists", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == created["id"]

    delete_response = client.delete(f"/compare-lists/{created['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json() == []
