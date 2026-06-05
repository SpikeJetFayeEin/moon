from __future__ import annotations

from datetime import date
from functools import lru_cache
from typing import Callable, Iterable, Protocol

from app.data.seed import FUNDS, NAV_SERIES
from app.models.schemas import Fund, FundPerformanceItem, FundProfile, NavPoint
from app.services.sync import (
    normalize_akshare_fund_performance_rows,
    normalize_akshare_fund_profile_rows,
    normalize_akshare_nav_rows,
)


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

    def get_profile(self, code: str) -> FundProfile | None:
        raise NotImplementedError

    def get_performance(self, code: str) -> list[FundPerformanceItem]:
        raise NotImplementedError

    def get_nav(self, code: str) -> list[NavPoint]:
        raise NotImplementedError

    def get_raw_nav(self, code: str) -> list[dict]:
        raise NotImplementedError


class SeedFundRepository:
    def __init__(
        self,
        extra_fund_rows: Callable[[], Iterable[dict]] | None = None,
        nav_rows_provider: Callable[[str], Iterable[dict]] | None = None,
        profile_rows_provider: Callable[[str], Iterable[dict]] | None = None,
        performance_rows_provider: Callable[[str], Iterable[dict]] | None = None,
    ) -> None:
        self._extra_fund_rows = extra_fund_rows
        self._nav_rows_provider = nav_rows_provider
        self._profile_rows_provider = profile_rows_provider
        self._performance_rows_provider = performance_rows_provider
        self._extra_funds_cache: list[Fund] | None = None

    def list_funds(
        self,
        q: str | None = None,
        fund_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Fund], int]:
        funds = self._all_funds(include_extra=bool(q))
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
        for fund in self._all_funds(include_extra=True):
            if fund.code == code:
                return fund
        return None

    def get_profile(self, code: str) -> FundProfile | None:
        profile = self._load_external_profile(code)
        if profile is not None:
            return profile
        fund = self.get_fund(code)
        return _profile_from_fund(fund) if fund is not None else None

    def get_performance(self, code: str) -> list[FundPerformanceItem]:
        return self._load_external_performance(code)

    def get_nav(self, code: str) -> list[NavPoint]:
        seed_points = NAV_SERIES.get(code, [])
        if seed_points:
            return [NavPoint(**point) for point in seed_points]
        return [NavPoint(**point) for point in self._load_external_nav(code)]

    def get_raw_nav(self, code: str) -> list[dict]:
        points = NAV_SERIES.get(code, [])
        if points:
            return [{"code": code, **point} for point in points]
        return [{"code": code, **point} for point in self._load_external_nav(code)]

    def _all_funds(self, include_extra: bool) -> list[Fund]:
        funds = [Fund(**fund) for fund in FUNDS]
        if not include_extra:
            return funds

        existing_codes = {fund.code for fund in funds}
        for fund in self._load_extra_funds():
            if fund.code not in existing_codes:
                funds.append(fund)
                existing_codes.add(fund.code)
        return funds

    def _load_extra_funds(self) -> list[Fund]:
        if self._extra_funds_cache is not None:
            return self._extra_funds_cache
        if self._extra_fund_rows is None:
            self._extra_funds_cache = []
            return []

        funds: list[Fund] = []
        try:
            rows = self._extra_fund_rows()
        except Exception:
            self._extra_funds_cache = []
            return []

        for row in rows:
            fund = _fund_from_catalog_row(row)
            if fund is not None:
                funds.append(fund)
        self._extra_funds_cache = funds
        return funds

    def _load_external_nav(self, code: str) -> list[dict]:
        if self._nav_rows_provider is None:
            return []
        try:
            return normalize_akshare_nav_rows(self._nav_rows_provider(code))
        except Exception:
            return []

    def _load_external_profile(self, code: str) -> FundProfile | None:
        if self._profile_rows_provider is None:
            return None
        try:
            profile = normalize_akshare_fund_profile_rows(
                code,
                self._profile_rows_provider(code),
            )
            if not profile.get("name"):
                return None
            return FundProfile(**profile)
        except Exception:
            return None

    def _load_external_performance(self, code: str) -> list[FundPerformanceItem]:
        if self._performance_rows_provider is None:
            return []
        try:
            return [
                FundPerformanceItem(**row)
                for row in normalize_akshare_fund_performance_rows(
                    self._performance_rows_provider(code)
                )
            ]
        except Exception:
            return []


class SupabaseFundRepository:
    _NAV_PAGE_SIZE = 1000

    def __init__(
        self,
        client,
    ) -> None:
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
            stripped_q = q.strip()
            if stripped_q.isdigit():
                query = query.eq("code", stripped_q)
            else:
                query = query.ilike("name", f"%{stripped_q}%")
        else:
            query = query.not_.is_("latest_nav", "null")
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

    def get_profile(self, code: str) -> FundProfile | None:
        response = (
            self._client.table("funds")
            .select("*")
            .eq("code", code)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return _profile_from_fund_row(response.data[0])

    def get_performance(self, code: str) -> list[FundPerformanceItem]:
        response = (
            self._client.table("fund_performance")
            .select("performance_type,period,return_rate,max_drawdown,rank")
            .eq("code", code)
            .order("performance_type")
            .execute()
        )
        return [FundPerformanceItem(**row) for row in response.data]

    def get_nav(self, code: str) -> list[NavPoint]:
        return [NavPoint(**row) for row in self._get_nav_rows(code)]

    def get_raw_nav(self, code: str) -> list[dict]:
        return [{"code": code, **row} for row in self._get_nav_rows(code)]

    def _get_nav_rows(self, code: str) -> list[dict]:
        return self._fetch_nav_rows(code)

    def _fetch_nav_rows(self, code: str) -> list[dict]:
        rows: list[dict] = []
        start = 0
        while True:
            end = start + self._NAV_PAGE_SIZE - 1
            response = (
                self._client.table("fund_nav")
                .select("date,nav,accumulated_nav")
                .eq("code", code)
                .order("date")
                .range(start, end)
                .execute()
            )
            batch = response.data
            rows.extend(batch)
            if len(batch) < self._NAV_PAGE_SIZE:
                return rows
            start += self._NAV_PAGE_SIZE

def _fund_from_catalog_row(row: dict) -> Fund | None:
    code = str(row.get("基金代码") or row.get("code") or "").strip()
    name = str(row.get("基金简称") or row.get("name") or "").strip()
    if not code or not name:
        return None

    return Fund(
        code=code,
        name=name,
        fund_type=str(row.get("基金类型") or row.get("fund_type") or "未知"),
        manager=str(row.get("基金管理人") or row.get("manager") or "待同步"),
        fund_manager=row.get("基金经理") or row.get("fund_manager"),
        inception_date=row.get("成立日期")
        or row.get("inception_date")
        or date(1970, 1, 1),
        latest_nav=_float_or_default(row.get("最新净值") or row.get("latest_nav"), 0),
        latest_nav_date=row.get("最新净值日期")
        or row.get("latest_nav_date")
        or date.today(),
        asset_size_billion=_float_or_default(
            row.get("资产规模") or row.get("asset_size_billion"),
            0,
        ),
    )


def _profile_from_fund(fund: Fund) -> FundProfile:
    return FundProfile(
        code=fund.code,
        name=fund.name,
        fund_company=fund.manager,
        fund_manager=fund.fund_manager,
        fund_type=fund.fund_type,
        inception_date=fund.inception_date,
        asset_size_billion=fund.asset_size_billion,
    )


def _profile_from_fund_row(row: dict) -> FundProfile:
    return FundProfile(
        code=str(row["code"]),
        name=str(row["name"]),
        full_name=row.get("full_name"),
        fund_company=row.get("fund_company") or row.get("manager"),
        fund_manager=row.get("fund_manager"),
        custodian=row.get("custodian"),
        fund_type=row.get("fund_type"),
        inception_date=row.get("inception_date"),
        asset_size_billion=row.get("asset_size_billion"),
        rating_source=row.get("rating_source"),
        rating=row.get("rating"),
        investment_strategy=row.get("investment_strategy"),
        investment_target=row.get("investment_target"),
        benchmark=row.get("benchmark"),
    )


def _float_or_default(value, default: float) -> float:
    if value is None or value == "":
        return default
    try:
        return float(str(value).replace(",", "").replace("亿元", ""))
    except ValueError:
        return default


@lru_cache(maxsize=1)
def load_akshare_fund_catalog() -> list[dict]:
    import akshare as ak

    return ak.fund_name_em().to_dict("records")


def load_akshare_nav_rows(code: str) -> list[dict]:
    import akshare as ak

    return ak.fund_open_fund_info_em(
        symbol=code,
        indicator="单位净值走势",
    ).to_dict("records")


def load_akshare_fund_profile_rows(code: str) -> list[dict]:
    import akshare as ak

    return ak.fund_individual_basic_info_xq(symbol=code, timeout=5).to_dict("records")


def load_akshare_fund_performance_rows(code: str) -> list[dict]:
    import akshare as ak

    return ak.fund_individual_achievement_xq(symbol=code, timeout=5).to_dict("records")


seed_fund_repository = SeedFundRepository(
    extra_fund_rows=load_akshare_fund_catalog,
    nav_rows_provider=load_akshare_nav_rows,
)
