import type { CompareItem, Fund, FundListResponse, FundMetrics, NavPoint } from "../types";
import { fixtureCompare, fixtureFundList, fixtureFunds, fixtureMetrics, fixtureNav } from "./fixtures";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
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

export async function getFundMetrics(code: string): Promise<FundMetrics> {
  try {
    return await request<FundMetrics>(`/funds/${code}/metrics`);
  } catch {
    return fixtureMetrics[code];
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
