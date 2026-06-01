import type {
  CompareItem,
  CompareList,
  DeploymentReadiness,
  Fund,
  FundListResponse,
  FundMetrics,
  MarketIndex,
  MarketIndexListResponse,
  NavPoint,
  PortfolioBacktestResponse,
  PortfolioHolding,
  WatchlistItem,
} from "../types";
import {
  fixtureCompare,
  fixtureFundList,
  fixtureFunds,
  fixtureIndexList,
  fixtureIndexNav,
  fixtureIndices,
  fixtureMetrics,
  fixtureNav,
  fixturePortfolioBacktest,
  fixtureReadiness,
} from "./fixtures";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type FundMetricsOptions = {
  startDate?: string;
  endDate?: string;
  holdingDays?: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listFunds(q: string): Promise<FundListResponse> {
  try {
    return await request<FundListResponse>(`/funds?q=${encodeURIComponent(q)}`);
  } catch {
    return fixtureFundList(q);
  }
}

export async function getFund(code: string): Promise<Fund> {
  try {
    return await request<Fund>(`/funds/${code}`);
  } catch {
    const fund = fixtureFunds.find((item) => item.code === code);
    if (!fund) throw new Error("Fund not found");
    return fund;
  }
}

export async function getFundNav(code: string): Promise<NavPoint[]> {
  try {
    const response = await request<{ code: string; items: NavPoint[] }>(`/funds/${code}/nav`);
    return response.items;
  } catch {
    return fixtureNav[code] ?? [];
  }
}

export async function getFundMetrics(
  code: string,
  options: FundMetricsOptions = {},
): Promise<FundMetrics> {
  const params = new URLSearchParams();
  if (options.startDate) params.set("start_date", options.startDate);
  if (options.endDate) params.set("end_date", options.endDate);
  if (options.holdingDays) params.set("holding_days", String(options.holdingDays));
  const query = params.toString();
  const path = `/funds/${code}/metrics${query ? `?${query}` : ""}`;
  try {
    return await request<FundMetrics>(path);
  } catch {
    return fixtureMetrics[code];
  }
}

export async function listIndices(): Promise<MarketIndexListResponse> {
  try {
    return await request<MarketIndexListResponse>("/indices");
  } catch {
    return fixtureIndexList();
  }
}

export async function getIndex(code: string): Promise<MarketIndex> {
  try {
    return await request<MarketIndex>(`/indices/${code}`);
  } catch {
    const index = fixtureIndices.find((item) => item.code === code);
    if (!index) throw new Error("Index not found");
    return index;
  }
}

export async function getIndexNav(code: string): Promise<NavPoint[]> {
  try {
    const response = await request<{ code: string; items: NavPoint[] }>(`/indices/${code}/nav`);
    return response.items;
  } catch {
    return fixtureIndexNav[code] ?? [];
  }
}

export async function getIndexMetrics(
  code: string,
  options: FundMetricsOptions = {},
): Promise<FundMetrics> {
  const params = new URLSearchParams();
  if (options.startDate) params.set("start_date", options.startDate);
  if (options.endDate) params.set("end_date", options.endDate);
  if (options.holdingDays) params.set("holding_days", String(options.holdingDays));
  const query = params.toString();
  const path = `/indices/${code}/metrics${query ? `?${query}` : ""}`;
  try {
    return await request<FundMetrics>(path);
  } catch {
    return fixtureMetrics[code];
  }
}

export async function backtestPortfolio(
  holdings: PortfolioHolding[],
): Promise<PortfolioBacktestResponse> {
  try {
    return await request<PortfolioBacktestResponse>("/portfolio/backtest", {
      method: "POST",
      body: JSON.stringify({ holdings }),
    });
  } catch {
    return fixturePortfolioBacktest(holdings);
  }
}

export async function getReadiness(): Promise<DeploymentReadiness> {
  try {
    return await request<DeploymentReadiness>("/readiness");
  } catch {
    return fixtureReadiness;
  }
}

export async function compareFunds(codes: string[]): Promise<CompareItem[]> {
  try {
    const response = await request<{ items: CompareItem[] }>("/compare", {
      method: "POST",
      body: JSON.stringify({ codes }),
    });
    return response.items;
  } catch {
    return fixtureCompare(codes);
  }
}

export async function addWatchlistItem(code: string, accessToken?: string): Promise<void> {
  if (!accessToken) return;
  await request(`/watchlist/${code}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function listWatchlist(accessToken?: string): Promise<WatchlistItem[]> {
  if (!accessToken) return [];
  return request<WatchlistItem[]>("/watchlist", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function removeWatchlistItem(code: string, accessToken?: string): Promise<void> {
  if (!accessToken) return;
  await request(`/watchlist/${code}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function saveCompareList(
  name: string,
  codes: string[],
  accessToken?: string,
): Promise<void> {
  if (!accessToken) return;
  await request("/compare-lists", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name, codes }),
  });
}

export async function listCompareLists(accessToken?: string): Promise<CompareList[]> {
  if (!accessToken) return [];
  return request<CompareList[]>("/compare-lists", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function deleteCompareList(id: string, accessToken?: string): Promise<void> {
  if (!accessToken) return;
  await request(`/compare-lists/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
