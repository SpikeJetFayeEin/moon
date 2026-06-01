from __future__ import annotations

import json
from datetime import UTC, date, datetime
from functools import lru_cache
from typing import Callable, Protocol
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.models.schemas import MarketIndex, NavPoint


TODAY = date.today()

INDEX_DEFINITIONS = {
    "ndx": {
        "name": "纳斯达克100全收益指数",
        "symbol": "XNDX",
        "return_type": "total_return",
        "currency": "USD",
        "provider": "Nasdaq Global Index Watch",
        "description": "NASDAQ-100 Total Return Index，包含成分股现金分红再投资后的总回报表现。",
        "source": "nasdaq",
    },
    "spx": {
        "name": "标普500全收益指数",
        "symbol": "^SP500TR",
        "return_type": "total_return",
        "currency": "USD",
        "provider": "Yahoo Finance",
        "description": "S&P 500 Total Return Index，包含现金分红再投资后的总回报表现。",
        "source": "yahoo",
    },
}

SEED_INDEX_SERIES = {
    "ndx": [
        {"date": date(2020, 1, 2), "value": 10287.2917},
        {"date": date(2020, 3, 23), "value": 8142.5438},
        {"date": date(2021, 1, 4), "value": 15537.0812},
        {"date": date(2022, 10, 14), "value": 12781.4921},
        {"date": date(2023, 12, 29), "value": 20634.0427},
        {"date": date(2024, 12, 31), "value": 26531.3184},
        {"date": date(2026, 5, 29), "value": 36993.1599},
    ],
    "spx": [
        {"date": date(2020, 1, 2), "value": 6561.0288},
        {"date": date(2020, 3, 23), "value": 4505.1777},
        {"date": date(2021, 1, 4), "value": 7797.1274},
        {"date": date(2022, 10, 14), "value": 7398.9043},
        {"date": date(2023, 12, 29), "value": 9972.9658},
        {"date": date(2024, 12, 31), "value": 12430.2275},
        {"date": date(2026, 5, 29), "value": 15091.3047},
    ],
}


class IndexRepository(Protocol):
    def list_indices(self) -> list[MarketIndex]:
        raise NotImplementedError

    def get_index(self, code: str) -> MarketIndex | None:
        raise NotImplementedError

    def get_nav(self, code: str) -> list[NavPoint]:
        raise NotImplementedError

    def get_raw_nav(self, code: str) -> list[dict]:
        raise NotImplementedError


class LiveIndexRepository:
    def __init__(
        self,
        fetch_nasdaq_rows: Callable[[str], list[dict]] = None,
        fetch_yahoo_rows: Callable[[str], list[dict]] = None,
    ) -> None:
        self._fetch_nasdaq_rows = fetch_nasdaq_rows or fetch_nasdaq_total_return_rows
        self._fetch_yahoo_rows = fetch_yahoo_rows or fetch_yahoo_chart_rows
        self._raw_cache: dict[str, list[dict]] = {}

    def list_indices(self) -> list[MarketIndex]:
        return [
            self.get_index(code)
            for code in INDEX_DEFINITIONS
            if self.get_index(code) is not None
        ]

    def get_index(self, code: str) -> MarketIndex | None:
        normalized_code = code.lower()
        definition = INDEX_DEFINITIONS.get(normalized_code)
        if definition is None:
            return None

        raw_nav = self.get_raw_nav(normalized_code)
        latest = raw_nav[-1] if raw_nav else {"date": TODAY, "raw_value": 0}
        return MarketIndex(
            code=normalized_code,
            name=str(definition["name"]),
            symbol=str(definition["symbol"]),
            return_type=str(definition["return_type"]),
            currency=str(definition["currency"]),
            provider=str(definition["provider"]),
            description=str(definition["description"]),
            latest_value=float(latest["raw_value"]),
            latest_date=_parse_date(latest["date"]),
        )

    def get_nav(self, code: str) -> list[NavPoint]:
        return [
            NavPoint(
                date=_parse_date(point["date"]),
                nav=float(point["nav"]),
                accumulated_nav=float(point["nav"]),
            )
            for point in self.get_raw_nav(code.lower())
        ]

    def get_raw_nav(self, code: str) -> list[dict]:
        normalized_code = code.lower()
        if normalized_code not in INDEX_DEFINITIONS:
            return []
        if normalized_code not in self._raw_cache:
            self._raw_cache[normalized_code] = self._load_index_series(normalized_code)
        return self._raw_cache[normalized_code]

    def _load_index_series(self, code: str) -> list[dict]:
        definition = INDEX_DEFINITIONS[code]
        try:
            if definition["source"] == "nasdaq":
                rows = self._fetch_nasdaq_rows(str(definition["symbol"]))
            else:
                rows = self._fetch_yahoo_rows(str(definition["symbol"]))
            normalized = normalize_index_rows(code, rows)
            if len(normalized) >= 2:
                return normalized
        except Exception:
            pass
        return normalize_index_rows(code, SEED_INDEX_SERIES[code])


class SupabaseIndexRepository:
    def __init__(self, client) -> None:
        self._client = client

    def list_indices(self) -> list[MarketIndex]:
        response = self._client.table("market_indices").select("*").execute()
        return [MarketIndex(**row) for row in response.data]

    def get_index(self, code: str) -> MarketIndex | None:
        response = (
            self._client.table("market_indices")
            .select("*")
            .eq("code", code.lower())
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return MarketIndex(**response.data[0])

    def get_nav(self, code: str) -> list[NavPoint]:
        response = (
            self._client.table("market_index_nav")
            .select("date,nav,accumulated_nav,raw_value")
            .eq("code", code.lower())
            .order("date")
            .execute()
        )
        return [
            NavPoint(
                date=row["date"],
                nav=float(row["nav"]),
                accumulated_nav=float(row.get("accumulated_nav") or row["nav"]),
            )
            for row in response.data
        ]

    def get_raw_nav(self, code: str) -> list[dict]:
        response = (
            self._client.table("market_index_nav")
            .select("date,nav,accumulated_nav,raw_value")
            .eq("code", code.lower())
            .order("date")
            .execute()
        )
        return [{"code": code.lower(), **row} for row in response.data]


def normalize_index_rows(code: str, rows: list[dict]) -> list[dict]:
    values = [
        {
            "code": code,
            "date": _parse_date(row.get("date") or row.get("Date") or row.get("x")),
            "raw_value": float(row.get("value") or row.get("close") or row.get("y")),
        }
        for row in rows
        if (row.get("value") or row.get("close") or row.get("y")) is not None
    ]
    values = sorted(values, key=lambda item: item["date"])
    if not values or values[0]["raw_value"] <= 0:
        return []

    first_value = values[0]["raw_value"]
    return [
        {
            "code": item["code"],
            "date": item["date"],
            "nav": item["raw_value"] / first_value,
            "accumulated_nav": item["raw_value"] / first_value,
            "raw_value": item["raw_value"],
        }
        for item in values
        if item["raw_value"] > 0
    ]


@lru_cache(maxsize=8)
def fetch_nasdaq_total_return_rows(symbol: str) -> list[dict]:
    body = f"id={symbol}&startDate=01/01/1985&endDate={TODAY:%m/%d/%Y}&timeOfDay=EOD".encode(
        "utf-8"
    )
    request = Request(
        "https://indexes.nasdaqomx.com/Index/HistoryChartData",
        data=body,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": f"https://indexes.nasdaqomx.com/index/History/{symbol}",
            "Origin": "https://indexes.nasdaqomx.com",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
        },
        method="POST",
    )
    with urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return [{"date": item["x"], "value": item["y"]} for item in payload]


@lru_cache(maxsize=8)
def fetch_yahoo_chart_rows(symbol: str) -> list[dict]:
    encoded_symbol = quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded_symbol}"
        "?period1=0&period2=1924992000&interval=1d"
    )
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))

    result = payload["chart"]["result"][0]
    timestamps = result["timestamp"]
    closes = result.get("indicators", {}).get("adjclose", [{}])[0].get("adjclose")
    if closes is None:
        closes = result["indicators"]["quote"][0]["close"]
    return [
        {"date": timestamp * 1000, "value": close}
        for timestamp, close in zip(timestamps, closes, strict=False)
        if close is not None
    ]


def _parse_date(value) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, UTC).date()
    return date.fromisoformat(str(value))


index_repository = LiveIndexRepository()
