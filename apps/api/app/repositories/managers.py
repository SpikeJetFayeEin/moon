from __future__ import annotations

from typing import Protocol

from app.models.schemas import FundManager, FundManagerTenure


class FundManagerRepository(Protocol):
    def list_managers(self, q: str | None = None) -> list[FundManager]:
        raise NotImplementedError

    def get_manager(self, manager_id: str) -> FundManager | None:
        raise NotImplementedError

    def list_active_tenures(self, manager_id: str) -> list[FundManagerTenure]:
        raise NotImplementedError


class InMemoryFundManagerRepository:
    def __init__(
        self,
        managers: list[FundManager] | None = None,
        tenures: list[FundManagerTenure] | None = None,
    ) -> None:
        self._managers = managers or []
        self._tenures = tenures or []

    def list_managers(self, q: str | None = None) -> list[FundManager]:
        managers = self._managers
        if q:
            keyword = q.strip().lower()
            managers = [
                manager
                for manager in managers
                if keyword in manager.name.lower() or keyword in manager.company.lower()
            ]
        return sorted(managers, key=lambda manager: manager.name)

    def get_manager(self, manager_id: str) -> FundManager | None:
        return next(
            (manager for manager in self._managers if manager.manager_id == manager_id),
            None,
        )

    def list_active_tenures(self, manager_id: str) -> list[FundManagerTenure]:
        return [
            tenure
            for tenure in self._tenures
            if tenure.manager_id == manager_id and tenure.is_active
        ]


class SupabaseFundManagerRepository:
    def __init__(self, client) -> None:
        self._client = client

    def list_managers(self, q: str | None = None) -> list[FundManager]:
        response = (
            self._client.table("fund_managers")
            .select("*")
            .order("name")
            .limit(2000)
            .execute()
        )
        managers = [FundManager(**row) for row in response.data]
        if not q:
            return managers
        keyword = q.strip().lower()
        return [
            manager
            for manager in managers
            if keyword in manager.name.lower() or keyword in manager.company.lower()
        ]

    def get_manager(self, manager_id: str) -> FundManager | None:
        response = (
            self._client.table("fund_managers")
            .select("*")
            .eq("manager_id", manager_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return FundManager(**response.data[0])

    def list_active_tenures(self, manager_id: str) -> list[FundManagerTenure]:
        response = (
            self._client.table("fund_manager_tenures")
            .select("*")
            .eq("manager_id", manager_id)
            .eq("is_active", True)
            .order("fund_code")
            .execute()
        )
        return [FundManagerTenure(**row) for row in response.data]


fund_manager_repository = InMemoryFundManagerRepository()
