from app.models.schemas import CompareListCreate
from app.repositories.users import InMemoryUserRepository, SupabaseUserRepository


def test_memory_repository_persists_watchlist_and_compare_lists():
    repository = InMemoryUserRepository()

    repository.add_watchlist_item("user-1", "000300")
    repository.add_watchlist_item("user-1", "110022")
    repository.remove_watchlist_item("user-1", "110022")
    compare_list = repository.create_compare_list(
        "user-1", CompareListCreate(name="核心宽基", codes=["000300", "110022"])
    )

    assert repository.list_watchlist_codes("user-1") == ["000300"]
    assert repository.list_compare_lists("user-1") == [compare_list]

    repository.delete_compare_list("user-1", compare_list.id)

    assert repository.list_compare_lists("user-1") == []


class FakeTableQuery:
    def __init__(self, table_name: str, calls: list[tuple]):
        self.table_name = table_name
        self.calls = calls
        self.data = []

    def select(self, columns: str):
        self.calls.append(("select", self.table_name, columns))
        return self

    def eq(self, column: str, value: str):
        self.calls.append(("eq", self.table_name, column, value))
        return self

    def order(self, column: str):
        self.calls.append(("order", self.table_name, column))
        return self

    def insert(self, payload: dict):
        self.calls.append(("insert", self.table_name, payload))
        self.data = [{**payload, "id": "saved-list-id", "created_at": "2026-05-31T00:00:00Z"}]
        return self

    def upsert(self, payload: dict, **kwargs):
        self.calls.append(("upsert", self.table_name, payload, kwargs))
        self.data = [{**payload, "created_at": "2026-05-31T00:00:00Z"}]
        return self

    def delete(self):
        self.calls.append(("delete", self.table_name))
        return self

    def execute(self):
        return self


class FakeSupabaseClient:
    def __init__(self):
        self.calls: list[tuple] = []

    def table(self, table_name: str) -> FakeTableQuery:
        self.calls.append(("table", table_name))
        return FakeTableQuery(table_name, self.calls)


def test_supabase_repository_writes_watchlist_and_compare_lists_to_expected_tables():
    client = FakeSupabaseClient()
    repository = SupabaseUserRepository(client)

    repository.add_watchlist_item("user-1", "000300")
    saved = repository.create_compare_list(
        "user-1", CompareListCreate(name="跟踪组合", codes=["000300", "110022"])
    )

    assert ("table", "watchlist") in client.calls
    assert (
        "upsert",
        "watchlist",
        {"user_id": "user-1", "code": "000300"},
        {"on_conflict": "user_id,code"},
    ) in client.calls
    assert ("table", "compare_lists") in client.calls
    assert saved.id == "saved-list-id"


def test_supabase_repository_ensures_profile_before_user_owned_writes():
    client = FakeSupabaseClient()
    repository = SupabaseUserRepository(client)

    repository.add_watchlist_item("user-1", "000300")
    repository.create_compare_list(
        "user-1", CompareListCreate(name="跟踪组合", codes=["000300", "110022"])
    )

    profile_upserts = [
        call
        for call in client.calls
        if call[0] == "upsert" and call[1] == "profiles" and call[2] == {"id": "user-1"}
    ]
    assert len(profile_upserts) == 2
