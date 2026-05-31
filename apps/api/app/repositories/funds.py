from __future__ import annotations

from app.data.seed import FUNDS, NAV_SERIES
from app.models.schemas import Fund, NavPoint


class FundRepository:
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


fund_repository = FundRepository()
