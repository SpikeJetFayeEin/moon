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


def test_returns_fund_metrics_for_detail_page():
    response = client.get("/funds/000300/metrics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == "000300"
    assert payload["total_return"] > 0
    assert "60" in payload["rolling_returns"]


def test_compares_multiple_funds():
    response = client.post("/compare", json={"codes": ["000300", "110022"]})

    assert response.status_code == 200
    payload = response.json()
    assert [item["code"] for item in payload["items"]] == ["000300", "110022"]


def test_watchlist_requires_authentication():
    response = client.get("/watchlist")

    assert response.status_code == 401
