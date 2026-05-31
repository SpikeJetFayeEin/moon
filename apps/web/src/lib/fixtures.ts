import type { CompareItem, Fund, FundListResponse, FundMetrics, NavPoint } from "../types";

const today = new Date();

function dateOffset(index: number): string {
  const date = new Date(today);
  date.setDate(today.getDate() - (59 - index));
  return date.toISOString().slice(0, 10);
}

function buildNav(start: number, changes: number[]): NavPoint[] {
  let nav = start;
  return changes.map((change, index) => {
    nav = Number((nav * (1 + change)).toFixed(4));
    return { date: dateOffset(index), nav, accumulated_nav: nav };
  });
}

export const fixtureFunds: Fund[] = [
  {
    code: "000300",
    name: "沪深300指数增强",
    fund_type: "指数增强",
    manager: "华夏基金",
    inception_date: "2018-01-08",
    latest_nav: 1.3268,
    latest_nav_date: dateOffset(59),
    asset_size_billion: 86.4,
  },
  {
    code: "110022",
    name: "易方达消费行业股票",
    fund_type: "股票型",
    manager: "易方达基金",
    inception_date: "2010-08-20",
    latest_nav: 3.2154,
    latest_nav_date: dateOffset(59),
    asset_size_billion: 214.7,
  },
  {
    code: "161725",
    name: "招商中证白酒指数",
    fund_type: "指数型",
    manager: "招商基金",
    inception_date: "2015-05-27",
    latest_nav: 1.8842,
    latest_nav_date: dateOffset(59),
    asset_size_billion: 392.1,
  },
];

export const fixtureNav: Record<string, NavPoint[]> = {
  "000300": buildNav(1, Array.from({ length: 60 }, (_, i) => 0.002 + ((i % 7) - 3) / 1000)),
  "110022": buildNav(2.3, Array.from({ length: 60 }, (_, i) => 0.003 + ((i % 9) - 4) / 700)),
  "161725": buildNav(1.5, Array.from({ length: 60 }, (_, i) => 0.001 + ((i % 8) - 3) / 450)),
};

export const fixtureMetrics: Record<string, FundMetrics> = {
  "000300": {
    code: "000300",
    total_return: 0.1982,
    annualized_return: 0.3111,
    max_drawdown: -0.0354,
    volatility: 0.1288,
    sharpe_ratio: 1.62,
    rolling_returns: { "20": [0.031, 0.038, 0.044], "60": [0.1982] },
    calculated_at: new Date().toISOString(),
  },
  "110022": {
    code: "110022",
    total_return: 0.1187,
    annualized_return: 0.2021,
    max_drawdown: -0.0825,
    volatility: 0.2217,
    sharpe_ratio: 0.88,
    rolling_returns: { "20": [0.024, 0.018, 0.033], "60": [0.1187] },
    calculated_at: new Date().toISOString(),
  },
  "161725": {
    code: "161725",
    total_return: 0.0794,
    annualized_return: 0.142,
    max_drawdown: -0.1176,
    volatility: 0.315,
    sharpe_ratio: 0.41,
    rolling_returns: { "20": [0.011, 0.029, -0.004], "60": [0.0794] },
    calculated_at: new Date().toISOString(),
  },
};

export function fixtureFundList(q = ""): FundListResponse {
  const lowered = q.toLowerCase();
  const items = fixtureFunds.filter(
    (fund) => fund.name.toLowerCase().includes(lowered) || fund.code.includes(lowered),
  );
  return { items, total: items.length, page: 1, page_size: 20 };
}

export function fixtureCompare(codes: string[]): CompareItem[] {
  return codes.map((code) => {
    const fund = fixtureFunds.find((item) => item.code === code)!;
    const metrics = fixtureMetrics[code];
    return {
      code,
      name: fund.name,
      total_return: metrics.total_return,
      max_drawdown: metrics.max_drawdown,
      volatility: metrics.volatility,
      sharpe_ratio: metrics.sharpe_ratio,
      nav: fixtureNav[code],
    };
  });
}
