from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

from app.models.schemas import CompareList, CompareListCreate


class UserRepository(Protocol):
    def list_watchlist_codes(self, user_id: str) -> list[str]:
        raise NotImplementedError

    def add_watchlist_item(self, user_id: str, code: str) -> None:
        raise NotImplementedError

    def remove_watchlist_item(self, user_id: str, code: str) -> None:
        raise NotImplementedError

    def list_compare_lists(self, user_id: str) -> list[CompareList]:
        raise NotImplementedError

    def create_compare_list(
        self, user_id: str, payload: CompareListCreate
    ) -> CompareList:
        raise NotImplementedError

    def delete_compare_list(self, user_id: str, list_id: str) -> None:
        raise NotImplementedError


class InMemoryUserRepository:
    def __init__(self) -> None:
        self._watchlists: dict[str, set[str]] = {}
        self._compare_lists: dict[str, list[CompareList]] = {}

    def list_watchlist_codes(self, user_id: str) -> list[str]:
        return sorted(self._watchlists.get(user_id, set()))

    def add_watchlist_item(self, user_id: str, code: str) -> None:
        self._watchlists.setdefault(user_id, set()).add(code)

    def remove_watchlist_item(self, user_id: str, code: str) -> None:
        self._watchlists.setdefault(user_id, set()).discard(code)

    def list_compare_lists(self, user_id: str) -> list[CompareList]:
        return self._compare_lists.get(user_id, [])

    def create_compare_list(
        self, user_id: str, payload: CompareListCreate
    ) -> CompareList:
        item = CompareList(
            id=str(uuid4()),
            name=payload.name,
            codes=payload.codes,
            created_at=datetime.now(UTC),
        )
        self._compare_lists.setdefault(user_id, []).append(item)
        return item

    def delete_compare_list(self, user_id: str, list_id: str) -> None:
        self._compare_lists[user_id] = [
            item for item in self._compare_lists.get(user_id, []) if item.id != list_id
        ]


class SupabaseUserRepository:
    def __init__(self, client) -> None:
        self._client = client

    def ensure_profile(self, user_id: str) -> None:
        self._client.table("profiles").upsert({"id": user_id}, on_conflict="id").execute()

    def list_watchlist_codes(self, user_id: str) -> list[str]:
        response = (
            self._client.table("watchlist")
            .select("code")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return [row["code"] for row in response.data]

    def add_watchlist_item(self, user_id: str, code: str) -> None:
        self.ensure_profile(user_id)
        (
            self._client.table("watchlist")
            .insert({"user_id": user_id, "code": code})
            .execute()
        )

    def remove_watchlist_item(self, user_id: str, code: str) -> None:
        (
            self._client.table("watchlist")
            .delete()
            .eq("user_id", user_id)
            .eq("code", code)
            .execute()
        )

    def list_compare_lists(self, user_id: str) -> list[CompareList]:
        response = (
            self._client.table("compare_lists")
            .select("id,name,codes,created_at")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return [CompareList(**row) for row in response.data]

    def create_compare_list(
        self, user_id: str, payload: CompareListCreate
    ) -> CompareList:
        self.ensure_profile(user_id)
        response = (
            self._client.table("compare_lists")
            .insert({"user_id": user_id, "name": payload.name, "codes": payload.codes})
            .execute()
        )
        return CompareList(**response.data[0])

    def delete_compare_list(self, user_id: str, list_id: str) -> None:
        (
            self._client.table("compare_lists")
            .delete()
            .eq("user_id", user_id)
            .eq("id", list_id)
            .execute()
        )
