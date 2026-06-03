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

    @property
    def not_(self):
        self.calls.append(("not", self.table_name))
        return self

    def is_(self, column: str, value: str):
        self.calls.append(("is", self.table_name, column, value))
        return self

    def upsert(self, payload, **kwargs):
        self.calls.append(("upsert", self.table_name, payload, kwargs))
        return self

    def update(self, payload):
        self.calls.append(("update", self.table_name, payload))
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


def test_supabase_fund_repository_hides_unsynced_catalog_rows_without_search():
    client = FakeSupabaseClient()
    repository = SupabaseFundRepository(client)

    repository.list_funds(page=1, page_size=10)

    assert ("not", "funds") in client.calls
    assert ("is", "funds", "latest_nav", "null") in client.calls


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
    assert ("range", "fund_nav", 0, 999) in client.calls


def test_supabase_fund_repository_syncs_missing_nav_from_provider():
    client = FakeSupabaseClient()
    repository = SupabaseFundRepository(
        client,
        nav_rows_provider=lambda code: [
            {"净值日期": date(2026, 1, 2), "单位净值": "1.02", "累计净值": "1.02"},
            {"净值日期": date(2026, 1, 1), "单位净值": "1.00", "累计净值": "1.00"},
        ],
    )

    nav = repository.get_nav("005094")

    assert [point.date.isoformat() for point in nav] == ["2026-01-01", "2026-01-02"]
    assert (
        "upsert",
        "fund_nav",
        [
            {
                "code": "005094",
                "date": "2026-01-01",
                "nav": 1.0,
                "accumulated_nav": 1.0,
            },
            {
                "code": "005094",
                "date": "2026-01-02",
                "nav": 1.02,
                "accumulated_nav": 1.02,
            },
        ],
        {"on_conflict": "code,date"},
    ) in client.calls
    assert (
        "update",
        "funds",
        {
            "inception_date": "2026-01-01",
            "latest_nav": 1.02,
            "latest_nav_date": "2026-01-02",
        },
    ) in client.calls


def test_supabase_fund_repository_refreshes_stale_cached_nav_from_provider():
    client = FakeSupabaseClient()
    cached_query = client.table("fund_nav")
    cached_query.data = [
        {"date": "2000-01-01", "nav": 1.0, "accumulated_nav": 1.0},
        {"date": "2000-01-02", "nav": 1.01, "accumulated_nav": 1.01},
    ]
    client.next_query = cached_query
    repository = SupabaseFundRepository(
        client,
        nav_rows_provider=lambda code: [
            {"净值日期": date(2000, 1, 1), "单位净值": "1.00", "累计净值": "1.00"},
            {"净值日期": date.today(), "单位净值": "1.20", "累计净值": "1.30"},
        ],
    )

    nav = repository.get_nav("005094")

    assert [point.date for point in nav] == [date(2000, 1, 1), date.today()]
    assert nav[-1].accumulated_nav == 1.3
    assert any(call[0] == "upsert" and call[1] == "fund_nav" for call in client.calls)
    assert (
        "update",
        "funds",
        {
            "inception_date": "2000-01-01",
            "latest_nav": 1.2,
            "latest_nav_date": date.today().isoformat(),
        },
    ) in client.calls


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
