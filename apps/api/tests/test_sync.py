from datetime import date

from app.services.sync import (
    normalize_akshare_fund_rows,
    sync_funds_to_supabase,
    sync_indices_to_supabase,
)


class FakeTableQuery:
    def __init__(self, table_name: str, calls: list[tuple]):
        self.table_name = table_name
        self.calls = calls

    def upsert(self, payload, **kwargs):
        self.calls.append(("upsert", self.table_name, payload, kwargs))
        return self

    def execute(self):
        return self


class FakeSupabaseClient:
    def __init__(self):
        self.calls: list[tuple] = []

    def table(self, table_name: str) -> FakeTableQuery:
        self.calls.append(("table", table_name))
        return FakeTableQuery(table_name, self.calls)


def test_normalizes_akshare_fund_rows_for_database_schema():
    rows = [{"基金代码": "000300", "基金简称": "沪深300指数增强", "基金类型": "指数增强"}]

    normalized = normalize_akshare_fund_rows(rows)

    assert normalized == [
        {
            "code": "000300",
            "name": "沪深300指数增强",
            "fund_type": "指数增强",
            "manager": "未知",
            "inception_date": date(1970, 1, 1),
            "latest_nav": None,
            "latest_nav_date": None,
            "asset_size_billion": 0,
        }
    ]


def test_sync_funds_to_supabase_upserts_funds_and_nav_rows():
    client = FakeSupabaseClient()
    fund_rows = [{"基金代码": "000300", "基金简称": "沪深300指数增强", "基金类型": "指数增强"}]

    def nav_provider(code: str):
        assert code == "000300"
        return [{"净值日期": date(2026, 5, 29), "单位净值": "1.2345", "累计净值": "1.2345"}]

    result = sync_funds_to_supabase(client, fund_rows, nav_provider)

    assert result.funds_seen == 1
    assert result.nav_rows_seen == 1
    assert ("table", "funds") in client.calls
    assert ("table", "fund_nav") in client.calls
    assert any(call[0] == "upsert" and call[1] == "funds" for call in client.calls)
    assert any(call[0] == "upsert" and call[1] == "fund_nav" for call in client.calls)


def test_sync_indices_to_supabase_upserts_index_metadata_and_nav_rows():
    client = FakeSupabaseClient()

    result = sync_indices_to_supabase(
        client,
        indices=[
            {
                "code": "ndx",
                "name": "纳斯达克100全收益指数",
                "symbol": "XNDX",
                "return_type": "total_return",
                "currency": "USD",
                "provider": "Nasdaq Global Index Watch",
                "description": "全收益指数",
            }
        ],
        nav_provider=lambda code: [
            {"code": code, "date": date(2020, 1, 2), "nav": 1, "raw_value": 100},
            {"code": code, "date": date(2020, 1, 3), "nav": 1.1, "raw_value": 110},
        ],
    )

    assert result.indices_seen == 1
    assert result.nav_rows_seen == 2
    assert ("table", "market_indices") in client.calls
    assert ("table", "market_index_nav") in client.calls
    assert any(call[0] == "upsert" and call[1] == "market_indices" for call in client.calls)
    assert any(call[0] == "upsert" and call[1] == "market_index_nav" for call in client.calls)
