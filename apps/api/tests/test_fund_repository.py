from datetime import date

from app.repositories.funds import SeedFundRepository, SupabaseFundRepository


class FakeTableQuery:
    def __init__(self, table_name: str, calls: list[tuple]):
        self.table_name = table_name
        self.calls = calls
        self.data = []
        self.count = 0

    def select(self, columns: str, **kwargs):
        self.calls.append(("select", self.table_name, columns, kwargs))
        return self

    def ilike(self, column: str, value: str):
        self.calls.append(("ilike", self.table_name, column, value))
        return self

    def eq(self, column: str, value: str):
        self.calls.append(("eq", self.table_name, column, value))
        return self

    def order(self, column: str):
        self.calls.append(("order", self.table_name, column))
        return self

    def range(self, start: int, end: int):
        self.calls.append(("range", self.table_name, start, end))
        return self

    def limit(self, value: int):
        self.calls.append(("limit", self.table_name, value))
        return self

    def execute(self):
        return self


class FakeSupabaseClient:
    def __init__(self):
        self.calls: list[tuple] = []
        self.next_query: FakeTableQuery | None = None

    def table(self, table_name: str) -> FakeTableQuery:
        self.calls.append(("table", table_name))
        if self.next_query is not None and self.next_query.table_name == table_name:
            query = self.next_query
            self.next_query = None
            return query
        return FakeTableQuery(table_name, self.calls)


def test_supabase_fund_repository_queries_fund_table_with_search_and_pagination():
    client = FakeSupabaseClient()
    repository = SupabaseFundRepository(client)

    repository.list_funds(q="沪深", page=2, page_size=10)

    assert ("table", "funds") in client.calls
    assert ("select", "funds", "*", {"count": "exact"}) in client.calls
    assert ("ilike", "funds", "name", "%沪深%") in client.calls
    assert ("range", "funds", 10, 19) in client.calls


def test_supabase_fund_repository_queries_fund_table_by_code():
    client = FakeSupabaseClient()
    repository = SupabaseFundRepository(client)

    repository.list_funds(q="519183", page=1, page_size=10)

    assert ("eq", "funds", "code", "519183") in client.calls


def test_supabase_fund_repository_allows_catalog_rows_without_nav_values():
    client = FakeSupabaseClient()
    query = client.table("funds")
    query.data = [
        {
            "code": "519183",
            "name": "万家双引擎灵活配置混合A",
            "fund_type": "混合型-灵活",
            "manager": "待同步",
            "inception_date": "1970-01-01",
            "latest_nav": None,
            "latest_nav_date": None,
            "asset_size_billion": None,
        }
    ]
    query.count = 1
    client.next_query = query
    repository = SupabaseFundRepository(client)

    funds, total = repository.list_funds(q="万家双引擎")

    assert total == 1
    assert funds[0].code == "519183"
    assert funds[0].latest_nav is None


def test_supabase_fund_repository_queries_nav_table_ordered_by_date():
    client = FakeSupabaseClient()
    repository = SupabaseFundRepository(client)

    repository.get_nav("000300")

    assert ("table", "fund_nav") in client.calls
    assert ("select", "fund_nav", "date,nav,accumulated_nav", {}) in client.calls
    assert ("eq", "fund_nav", "code", "000300") in client.calls
    assert ("order", "fund_nav", "date") in client.calls


def test_seed_fund_repository_searches_external_catalog_rows():
    repository = SeedFundRepository(
        extra_fund_rows=lambda: [
            {
                "code": "519674",
                "name": "银河创新成长混合A",
                "fund_type": "混合型",
                "manager": "银河基金",
                "inception_date": date(2010, 12, 29),
                "latest_nav": 5.1234,
                "latest_nav_date": date(2026, 5, 29),
                "asset_size_billion": 120.5,
            }
        ]
    )

    funds, total = repository.list_funds(q="519674")

    assert total == 1
    assert funds[0].code == "519674"
