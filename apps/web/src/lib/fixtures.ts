import type {
  CompareItem,
  DeploymentReadiness,
  Fund,
  FundListResponse,
  FundMetrics,
  MarketIndex,
  MarketIndexListResponse,
  NavPoint,
  PortfolioBacktestResponse,
  PortfolioHolding,
} from "../types";

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

export const fixtureIndices: MarketIndex[] = [
  {
    code: "ndx",
    name: "纳斯达克100全收益指数",
    symbol: "XNDX",
    return_type: "total_return",
    currency: "USD",
    provider: "Nasdaq Global Index Watch",
    description: "NASDAQ-100 Total Return Index，包含成分股现金分红再投资后的总回报表现。",
    latest_value: 36993.1599,
    latest_date: "2026-05-29",
  },
  {
    code: "spx",
    name: "标普500全收益指数",
    symbol: "^SP500TR",
    return_type: "total_return",
    currency: "USD",
    provider: "Yahoo Finance",
    description: "S&P 500 Total Return Index，包含现金分红再投资后的总回报表现。",
    latest_value: 15091.3047,
    latest_date: "2026-05-29",
  },
];

export const fixtureIndexNav: Record<string, NavPoint[]> = {
  ndx: buildNav(1, Array.from({ length: 60 }, (_, i) => 0.003 + ((i % 10) - 4) / 650)),
  spx: buildNav(1, Array.from({ length: 60 }, (_, i) => 0.002 + ((i % 9) - 4) / 800)),
};

const advancedMetricDefaults = {
  downside_volatility: 0.096,
  sortino_ratio: 2.1,
  calmar_ratio: 3.4,
  positive_day_rate: 0.58,
  best_daily_return: 0.041,
  worst_daily_return: -0.032,
  value_at_risk_95: -0.018,
  conditional_value_at_risk_95: -0.026,
  period_returns: {
    "1w": 0.018,
    "1m": 0.042,
    "3m": 0.086,
    "6m": 0.121,
    "1y": 0.198,
    "3y": null,
    "5y": null,
    ytd: 0.083,
    since_inception: 0.198,
  },
  yearly_returns: { "2026": 0.083 },
};

export const fixtureReadiness: DeploymentReadiness = {
  status: "degraded",
  checks: {
    cors_origins: true,
    supabase_database: false,
    supabase_auth_jwt: false,
    akshare_sync: false,
  },
  configured_env: ["API_CORS_ORIGINS"],
  missing_env: [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "AKSHARE_ENABLED",
  ],
};

export const fixtureMetrics: Record<string, FundMetrics> = {
  "000300": {
    code: "000300",
    total_return: 0.1982,
    annualized_return: 0.3111,
    max_drawdown: -0.0354,
    volatility: 0.1288,
    sharpe_ratio: 1.62,
    ...advancedMetricDefaults,
    rolling_returns: { "20": [0.031, 0.038, 0.044], "60": [0.1982], "180": [0.1982] },
    holding_analysis: {
      holding_days: 30,
      sample_count: 30,
      win_rate: 0.73,
      average_return: 0.031,
      median_return: 0.028,
      best_return: 0.062,
      worst_return: -0.018,
    },
    calculated_at: new Date().toISOString(),
  },
  "110022": {
    code: "110022",
    total_return: 0.1187,
    annualized_return: 0.2021,
    max_drawdown: -0.0825,
    volatility: 0.2217,
    sharpe_ratio: 0.88,
    ...advancedMetricDefaults,
    rolling_returns: { "20": [0.024, 0.018, 0.033], "60": [0.1187], "180": [0.1187] },
    holding_analysis: {
      holding_days: 30,
      sample_count: 30,
      win_rate: 0.6,
      average_return: 0.021,
      median_return: 0.019,
      best_return: 0.071,
      worst_return: -0.045,
    },
    calculated_at: new Date().toISOString(),
  },
  "161725": {
    code: "161725",
    total_return: 0.0794,
    annualized_return: 0.142,
    max_drawdown: -0.1176,
    volatility: 0.315,
    sharpe_ratio: 0.41,
    ...advancedMetricDefaults,
    rolling_returns: { "20": [0.011, 0.029, -0.004], "60": [0.0794], "180": [0.0794] },
    holding_analysis: {
      holding_days: 30,
      sample_count: 30,
      win_rate: 0.53,
      average_return: 0.014,
      median_return: 0.011,
      best_return: 0.084,
      worst_return: -0.067,
    },
    calculated_at: new Date().toISOString(),
  },
  ndx: {
    code: "ndx",
    total_return: 2.596,
    annualized_return: 0.265,
    max_drawdown: -0.318,
    volatility: 0.282,
    sharpe_ratio: 0.91,
    ...advancedMetricDefaults,
    rolling_returns: { "20": [0.026, 0.041, 0.053], "60": [0.184], "180": [0.184] },
    holding_analysis: {
      holding_days: 30,
      sample_count: 30,
      win_rate: 0.67,
      average_return: 0.035,
      median_return: 0.031,
      best_return: 0.128,
      worst_return: -0.091,
    },
    calculated_at: new Date().toISOString(),
  },
  spx: {
    code: "spx",
    total_return: 1.3,
    annualized_return: 0.172,
    max_drawdown: -0.242,
    volatility: 0.205,
    sharpe_ratio: 0.78,
    ...advancedMetricDefaults,
    rolling_returns: { "20": [0.018, 0.025, 0.031], "60": [0.112], "180": [0.112] },
    holding_analysis: {
      holding_days: 30,
      sample_count: 30,
      win_rate: 0.7,
      average_return: 0.023,
      median_return: 0.02,
      best_return: 0.084,
      worst_return: -0.061,
    },
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

export function fixtureIndexList(): MarketIndexListResponse {
  return { items: fixtureIndices };
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

export function fixturePortfolioBacktest(
  holdings: PortfolioHolding[],
  benchmark?: PortfolioHolding,
): PortfolioBacktestResponse {
  const nav = fixtureNav["000300"];
  const totalWeight = holdings.reduce((sum, holding) => sum + holding.weight, 0);
  const metrics = { ...fixtureMetrics["000300"], code: "portfolio" };
  return {
    initial_value: 1,
    nav,
    drawdowns: nav.map((point, index) => ({
      date: point.date,
      drawdown: index % 9 === 0 ? -0.02 : 0,
    })),
    metrics,
    contributions: holdings.map((holding) => ({
      ...holding,
      weight: holding.weight / totalWeight,
      total_return: fixtureMetrics[holding.code]?.total_return ?? 0.1,
      contribution: (holding.weight / totalWeight) * (fixtureMetrics[holding.code]?.total_return ?? 0.1),
    })),
    rebalance_dates: [nav[20]?.date, nav[40]?.date].filter(Boolean),
    benchmark: benchmark
      ? {
          asset_type: benchmark.asset_type,
          code: benchmark.code,
          nav: fixtureIndexNav[benchmark.code] ?? fixtureNav[benchmark.code] ?? nav,
          metrics: fixtureMetrics[benchmark.code] ?? fixtureMetrics["000300"],
          excess_return:
            metrics.total_return -
            (fixtureMetrics[benchmark.code]?.total_return ?? fixtureMetrics["000300"].total_return),
          tracking_error: 0.08,
          information_ratio: 0.55,
        }
      : undefined,
  };
}
