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


def test_authenticated_user_can_manage_watchlist():
    headers = {"Authorization": "Bearer api-user-watchlist"}

    add_response = client.post("/watchlist/000300", headers=headers)
    assert add_response.status_code == 200
    assert add_response.json() == [{"code": "000300", "name": "沪深300指数增强"}]

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
