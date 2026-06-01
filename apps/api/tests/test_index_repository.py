from datetime import date

from app.repositories.indices import LiveIndexRepository, SupabaseIndexRepository, normalize_index_rows


class FakeTableQuery:
    def __init__(self, table_name: str, calls: list[tuple], data: list[dict]):
        self.table_name = table_name
        self.calls = calls
        self.data = data

    def select(self, columns: str, **kwargs):
        self.calls.append(("select", self.table_name, columns, kwargs))
        return self

    def eq(self, column: str, value: str):
        self.calls.append(("eq", self.table_name, column, value))
        self.data = [row for row in self.data if row.get(column) == value]
        return self

    def order(self, column: str):
        self.calls.append(("order", self.table_name, column))
        self.data = sorted(self.data, key=lambda row: row[column])
        return self

    def limit(self, value: int):
        self.calls.append(("limit", self.table_name, value))
        self.data = self.data[:value]
        return self

    def execute(self):
        return self


class FakeSupabaseClient:
    def __init__(self):
        self.calls: list[tuple] = []
        self.tables = {
            "market_indices": [
                {
                    "code": "ndx",
                    "name": "纳斯达克100全收益指数",
                    "symbol": "XNDX",
                    "return_type": "total_return",
                    "currency": "USD",
                    "provider": "Nasdaq Global Index Watch",
                    "description": "全收益指数",
                    "latest_value": 200,
                    "latest_date": date(2026, 5, 29),
                }
            ],
            "market_index_nav": [
                {
                    "code": "ndx",
                    "date": date(2020, 1, 2),
                    "nav": 1,
                    "accumulated_nav": 1,
                    "raw_value": 100,
                },
                {
                    "code": "ndx",
                    "date": date(2020, 1, 3),
                    "nav": 2,
                    "accumulated_nav": 2,
                    "raw_value": 200,
                },
            ],
        }

    def table(self, table_name: str) -> FakeTableQuery:
        self.calls.append(("table", table_name))
        return FakeTableQuery(table_name, self.calls, list(self.tables.get(table_name, [])))


def test_normalizes_index_rows_to_total_return_nav():
    rows = normalize_index_rows(
        "ndx",
        [
            {"date": date(2020, 1, 3), "value": 110},
            {"date": date(2020, 1, 2), "value": 100},
        ],
    )

    assert rows == [
        {
            "code": "ndx",
            "date": date(2020, 1, 2),
            "nav": 1,
            "accumulated_nav": 1,
            "raw_value": 100,
        },
        {
            "code": "ndx",
            "date": date(2020, 1, 3),
            "nav": 1.1,
            "accumulated_nav": 1.1,
            "raw_value": 110,
        },
    ]


def test_live_index_repository_falls_back_to_seed_when_provider_fails():
    repository = LiveIndexRepository(
        fetch_nasdaq_rows=lambda _symbol: (_ for _ in ()).throw(RuntimeError("down")),
    )

    nav = repository.get_nav("ndx")

    assert len(nav) >= 2
    assert nav[0].nav == 1


def test_supabase_index_repository_reads_index_and_ordered_nav_tables():
    client = FakeSupabaseClient()
    repository = SupabaseIndexRepository(client)

    market_index = repository.get_index("ndx")
    nav = repository.get_nav("ndx")

    assert market_index is not None
    assert market_index.code == "ndx"
    assert nav[-1].nav == 2
    assert ("table", "market_indices") in client.calls
    assert ("select", "market_indices", "*", {}) in client.calls
    assert ("eq", "market_indices", "code", "ndx") in client.calls
    assert ("table", "market_index_nav") in client.calls
    assert ("select", "market_index_nav", "date,nav,accumulated_nav,raw_value", {}) in client.calls
    assert ("order", "market_index_nav", "date") in client.calls
