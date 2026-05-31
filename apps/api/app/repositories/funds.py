from __future__ import annotations

from typing import Protocol

from app.data.seed import FUNDS, NAV_SERIES
from app.models.schemas import Fund, NavPoint


class FundRepository(Protocol):
    def list_funds(
        self,
        q: str | None = None,
        fund_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Fund], int]:
        raise NotImplementedError

    def get_fund(self, code: str) -> Fund | None:
        raise NotImplementedError

    def get_nav(self, code: str) -> list[NavPoint]:
        raise NotImplementedError

    def get_raw_nav(self, code: str) -> list[dict]:
        raise NotImplementedError


class SeedFundRepository:
    def list_funds(
        self,
        q: str | None = None,
        fund_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Fund], int]:
        funds = [Fund(**fund) for fund in FUNDS]
        if q:
            lowered = q.lower()
            funds = [
                fund
                for fund in funds
                if lowered in fund.name.lower() or lowered in fund.code.lower()
            ]
        if fund_type:
            funds = [fund for fund in funds if fund.fund_type == fund_type]
        total = len(funds)
        start = (page - 1) * page_size
        end = start + page_size
        return funds[start:end], total

    def get_fund(self, code: str) -> Fund | None:
        for fund in FUNDS:
            if fund["code"] == code:
                return Fund(**fund)
        return None

    def get_nav(self, code: str) -> list[NavPoint]:
        return [NavPoint(**point) for point in NAV_SERIES.get(code, [])]

    def get_raw_nav(self, code: str) -> list[dict]:
        points = NAV_SERIES.get(code, [])
        return [{"code": code, **point} for point in points]


class SupabaseFundRepository:
    def __init__(self, client) -> None:
        self._client = client

    def list_funds(
        self,
        q: str | None = None,
        fund_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Fund], int]:
        start = (page - 1) * page_size
        end = start + page_size - 1
        query = self._client.table("funds").select("*", count="exact")
        if q:
            query = query.ilike("name", f"%{q}%")
        if fund_type:
            query = query.eq("fund_type", fund_type)
        response = query.range(start, end).execute()
        return [Fund(**row) for row in response.data], response.count or len(response.data)

    def get_fund(self, code: str) -> Fund | None:
        response = (
            self._client.table("funds")
            .select("*")
            .eq("code", code)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return Fund(**response.data[0])

    def get_nav(self, code: str) -> list[NavPoint]:
        response = (
            self._client.table("fund_nav")
            .select("date,nav,accumulated_nav")
            .eq("code", code)
            .order("date")
            .execute()
        )
        return [NavPoint(**row) for row in response.data]

    def get_raw_nav(self, code: str) -> list[dict]:
        response = (
            self._client.table("fund_nav")
            .select("date,nav,accumulated_nav")
            .eq("code", code)
            .order("date")
            .execute()
        )
        return [{"code": code, **row} for row in response.data]


seed_fund_repository = SeedFundRepository()
