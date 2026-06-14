import type {
  DeleteSyncResponse,
  DeploymentReadiness,
  DrawdownPoint,
  DrawdownSeriesResponse,
  Fund,
  FundListResponse,
  FundManager,
  FundManagerComparisonPeriod,
  FundManagerListResponse,
  FundManagerProductComparison,
  FundManagerSyncResponse,
  FundMetrics,
  FundPerformanceItem,
  FundPerformanceResponse,
  FundProfile,
  MarketIndex,
  MarketIndexListResponse,
  NavPoint,
  SyncResponse,
} from "../types";
import {
  fixtureFundList,
  fixtureFundManagerComparison,
  fixtureFundManagerList,
  fixtureFundManagers,
  fixtureFunds,
  fixtureIndexList,
  fixtureIndexNav,
  fixtureIndices,
  fixtureMetrics,
  fixtureNav,
  fixtureReadiness,
} from "./fixtures";

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\uFEFF/g, "").trim();
  return cleaned || undefined;
}

const API_BASE_URL =
  cleanEnvValue(import.meta.env.VITE_API_BASE_URL) ??
  (import.meta.env.DEV ? "http://localhost:8000" : "/api");
const API_REQUEST_TIMEOUT_MS = 3500;

export type FundMetricsOptions = {
  startDate?: string;
  endDate?: string;
  holdingDays?: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  };
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options?.signal ?? controller.signal,
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`API request did not return application/json: ${contentType || "unknown"}`);
    }
    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function listSyncedFunds(): Promise<FundListResponse> {
  try {
    return await request<FundListResponse>("/funds");
  } catch {
    return fixtureFundList("");
  }
}

export async function searchFundCandidates(q: string): Promise<FundListResponse> {
  return listFunds(q);
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

export async function getFundProfile(code: string): Promise<FundProfile> {
  try {
    return await request<FundProfile>(`/funds/${code}/profile`);
  } catch {
    const fund = fixtureFunds.find((item) => item.code === code);
    if (!fund) throw new Error("Fund profile not found");
    return {
      code: fund.code,
      name: fund.name,
      fund_company: fund.manager,
      fund_manager: fund.fund_manager,
      fund_type: fund.fund_type,
      inception_date: fund.inception_date,
      asset_size_billion: fund.asset_size_billion,
    };
  }
}

export async function getFundPerformance(code: string): Promise<FundPerformanceItem[]> {
  try {
    const response = await request<FundPerformanceResponse>(`/funds/${code}/performance`);
    return response.items;
  } catch {
    return [];
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

export async function getFundDrawdowns(code: string): Promise<DrawdownPoint[]> {
  try {
    const response = await request<DrawdownSeriesResponse>(`/funds/${code}/drawdowns`);
    return response.items;
  } catch {
    return buildDrawdownSeries(fixtureNav[code] ?? []);
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

export async function searchFundManagers(q: string): Promise<FundManagerListResponse> {
  try {
    return await request<FundManagerListResponse>(`/fund-managers?q=${encodeURIComponent(q)}`);
  } catch {
    return fixtureFundManagerList(q);
  }
}

export async function syncFundManagers(): Promise<FundManagerSyncResponse> {
  return request<FundManagerSyncResponse>("/fund-managers/sync", { method: "POST" });
}

export async function getFundManager(managerId: string): Promise<FundManager> {
  try {
    return await request<FundManager>(`/fund-managers/${managerId}`);
  } catch {
    const manager = fixtureFundManagers.find((item) => item.manager_id === managerId);
    if (!manager) throw new Error("Fund manager not found");
    return manager;
  }
}

export async function getFundManagerProductComparison(
  managerId: string,
  period: FundManagerComparisonPeriod,
): Promise<FundManagerProductComparison> {
  try {
    return await request<FundManagerProductComparison>(
      `/fund-managers/${managerId}/products/comparison?period=${period}`,
    );
  } catch {
    return fixtureFundManagerComparison(managerId, period);
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

export async function getIndexDrawdowns(code: string): Promise<DrawdownPoint[]> {
  try {
    const response = await request<DrawdownSeriesResponse>(`/indices/${code}/drawdowns`);
    return response.items;
  } catch {
    return buildDrawdownSeries(fixtureIndexNav[code] ?? []);
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

export async function syncFund(code: string): Promise<SyncResponse> {
  try {
    return await request<SyncResponse>(`/funds/${code}/sync`, { method: "POST" });
  } catch {
    return skippedSync("fund", code);
  }
}

export async function deleteSyncedFund(code: string): Promise<DeleteSyncResponse> {
  return request<DeleteSyncResponse>(`/funds/${code}/sync`, { method: "DELETE" });
}

export async function syncIndex(code: string): Promise<SyncResponse> {
  try {
    return await request<SyncResponse>(`/indices/${code}/sync`, { method: "POST" });
  } catch {
    return skippedSync("index", code);
  }
}

export async function deleteSyncedIndex(code: string): Promise<DeleteSyncResponse> {
  return request<DeleteSyncResponse>(`/indices/${code}/sync`, { method: "DELETE" });
}

export async function getReadiness(): Promise<DeploymentReadiness> {
  try {
    return await request<DeploymentReadiness>("/readiness");
  } catch {
    return fixtureReadiness;
  }
}

function skippedSync(assetType: "fund" | "index", code: string): SyncResponse {
  return {
    asset_type: assetType,
    code,
    items_seen: 0,
    nav_rows_seen: 0,
    synced_at: new Date().toISOString().slice(0, 10),
    status: "skipped",
  };
}

function buildDrawdownSeries(nav: NavPoint[]): DrawdownPoint[] {
  let peak = 0;
  return nav.map((point) => {
    const value = point.accumulated_nav ?? point.nav;
    peak = Math.max(peak, value);
    return {
      date: point.date,
      drawdown: peak ? value / peak - 1 : 0,
    };
  });
}
