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


def test_supabase_fund_repository_returns_empty_nav_without_request_time_sync():
    client = FakeSupabaseClient()
    repository = SupabaseFundRepository(client)

    nav = repository.get_nav("005094")

    assert nav == []
    assert not any(call[0] == "upsert" and call[1] == "fund_nav" for call in client.calls)


def test_supabase_fund_repository_uses_stale_cached_nav_without_request_time_refresh():
    client = FakeSupabaseClient()
    cached_query = client.table("fund_nav")
    cached_query.data = [
        {"date": "2000-01-01", "nav": 1.0, "accumulated_nav": 1.0},
        {"date": "2000-01-02", "nav": 1.01, "accumulated_nav": 1.01},
    ]
    client.next_query = cached_query
    repository = SupabaseFundRepository(client)

    nav = repository.get_nav("005094")

    assert [point.date for point in nav] == [date(2000, 1, 1), date(2000, 1, 2)]
    assert nav[-1].accumulated_nav == 1.01
    assert not any(call[0] == "upsert" and call[1] == "fund_nav" for call in client.calls)


def test_supabase_fund_repository_reads_profile_from_database_without_provider_call():
    client = FakeSupabaseClient()
    query = client.table("funds")
    query.data = [
        {
            "code": "005094",
            "name": "万家臻选混合A",
            "full_name": "万家臻选混合型证券投资基金",
            "fund_type": "混合型",
            "manager": "万家基金",
            "fund_manager": "莫海波",
            "custodian": "中国工商银行",
            "benchmark": "沪深300指数收益率*80%+上证国债指数收益率*20%",
            "investment_strategy": "精选个股。",
            "investment_target": "追求长期稳定增值。",
            "rating_source": None,
            "rating": None,
            "inception_date": date(2017, 12, 20),
            "latest_nav": 5.9512,
            "latest_nav_date": date(2026, 6, 3),
            "asset_size_billion": 21.22,
        }
    ]
    client.next_query = query
    repository = SupabaseFundRepository(client)

    profile = repository.get_profile("005094")

    assert profile is not None
    assert profile.fund_company == "万家基金"


def test_supabase_fund_repository_reads_nav_from_database_without_refresh_provider_call():
    client = FakeSupabaseClient()
    query = client.table("fund_nav")
    query.data = [
        {"date": "2000-01-01", "nav": 1.0, "accumulated_nav": 1.0},
        {"date": "2000-01-02", "nav": 1.01, "accumulated_nav": 1.01},
    ]
    client.next_query = query
    repository = SupabaseFundRepository(client)

    nav = repository.get_nav("005094")

    assert [point.date for point in nav] == [date(2000, 1, 1), date(2000, 1, 2)]


def test_supabase_fund_repository_reads_performance_from_database_without_provider_call():
    client = FakeSupabaseClient()
    query = client.table("fund_performance")
    query.data = [
        {
            "performance_type": "stage",
            "period": "近1年",
            "return_rate": 1.35620993,
            "max_drawdown": -0.1256,
            "rank": "335/4562",
        }
    ]
    client.next_query = query
    repository = SupabaseFundRepository(client)

    performance = repository.get_performance("005094")

    assert len(performance) == 1
    assert performance[0].performance_type == "stage"
    assert performance[0].rank == "335/4562"


def test_seed_fund_repository_searches_external_catalog_rows():
    repository = SeedFundRepository(
        extra_fund_rows=lambda: [
            {
                "code": "519674",
                "name": "银河创新成长混合A",
                "fund_type": "混合型",
                "manager": "银河基金",
                "fund_manager": "郑巍山",
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
    assert funds[0].fund_manager == "郑巍山"


def test_seed_fund_repository_loads_external_fund_profile_rows():
    repository = SeedFundRepository(
        extra_fund_rows=lambda: [],
        profile_rows_provider=lambda code: [
            {"item": "基金代码", "value": code},
            {"item": "基金名称", "value": "万家臻选混合A"},
            {"item": "基金公司", "value": "万家基金"},
            {"item": "基金经理", "value": "莫海波"},
            {"item": "托管银行", "value": "中国工商银行"},
            {"item": "业绩比较基准", "value": "沪深300指数收益率*80%+上证国债指数收益率*20%"},
        ],
    )

    profile = repository.get_profile("005094")

    assert profile is not None
    assert profile.code == "005094"
    assert profile.fund_company == "万家基金"
    assert profile.fund_manager == "莫海波"
    assert profile.custodian == "中国工商银行"
    assert profile.benchmark == "沪深300指数收益率*80%+上证国债指数收益率*20%"


def test_seed_fund_repository_loads_external_fund_performance_rows():
    repository = SeedFundRepository(
        extra_fund_rows=lambda: [],
        performance_rows_provider=lambda code: [
            {
                "业绩类型": "阶段业绩",
                "周期": "近1年",
                "本产品区间收益": 135.620993,
                "本产品最大回撒": 12.56,
                "周期收益同类排名": "335/4562",
            }
        ],
    )

    performance = repository.get_performance("005094")

    assert len(performance) == 1
    assert performance[0].performance_type == "stage"
    assert performance[0].period == "近1年"
    assert performance[0].return_rate == 1.35620993
    assert performance[0].max_drawdown == -0.1256
    assert performance[0].rank == "335/4562"


def test_supabase_fund_repository_loads_profile_from_fund_table_columns():
    client = FakeSupabaseClient()
    query = client.table("funds")
    query.data = [
        {
            "code": "005094",
            "name": "万家臻选混合A",
            "full_name": "万家臻选混合型证券投资基金",
            "fund_type": "混合型",
            "manager": "万家基金",
            "fund_manager": "莫海波",
            "custodian": "中国工商银行",
            "benchmark": "沪深300指数收益率*80%+上证国债指数收益率*20%",
            "investment_strategy": "精选个股。",
            "investment_target": "追求长期稳定增值。",
            "rating_source": None,
            "rating": None,
            "inception_date": date(2017, 12, 20),
            "latest_nav": 5.9512,
            "latest_nav_date": date(2026, 6, 3),
            "asset_size_billion": 21.22,
        }
    ]
    client.next_query = query
    repository = SupabaseFundRepository(client)

    profile = repository.get_profile("005094")

    assert profile is not None
    assert profile.full_name == "万家臻选混合型证券投资基金"
    assert profile.fund_company == "万家基金"
    assert profile.fund_manager == "莫海波"
    assert profile.custodian == "中国工商银行"
    assert profile.benchmark == "沪深300指数收益率*80%+上证国债指数收益率*20%"
