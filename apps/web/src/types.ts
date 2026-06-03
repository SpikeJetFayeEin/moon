export type Fund = {
  code: string;
  name: string;
  fund_type: string;
  manager: string;
  inception_date: string;
  latest_nav: number | null;
  latest_nav_date: string | null;
  asset_size_billion: number | null;
};

export type FundListResponse = {
  items: Fund[];
  total: number;
  page: number;
  page_size: number;
};

export type MarketIndex = {
  code: string;
  name: string;
  symbol: string;
  return_type: string;
  currency: string;
  provider: string;
  description: string;
  latest_value: number;
  latest_date: string;
};

export type MarketIndexListResponse = {
  items: MarketIndex[];
};

export type DeploymentReadiness = {
  status: "ready" | "degraded";
  checks: Record<string, boolean>;
  configured_env: string[];
  missing_env: string[];
};

export type NavPoint = {
  date: string;
  nav: number;
  accumulated_nav?: number;
};

export type DrawdownPoint = {
  date: string;
  drawdown: number;
};

export type FundMetrics = {
  code: string;
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  volatility: number;
  sharpe_ratio: number;
  downside_volatility: number;
  sortino_ratio: number;
  calmar_ratio: number;
  positive_day_rate: number;
  best_daily_return: number;
  worst_daily_return: number;
  value_at_risk_95: number;
  conditional_value_at_risk_95: number;
  period_returns: Record<string, number | null>;
  yearly_returns: Record<string, number>;
  rolling_returns: Record<string, number[]>;
  holding_analysis: HoldingAnalysis;
  calculated_at: string;
};

export type HoldingAnalysis = {
  holding_days: number;
  sample_count: number;
  win_rate: number;
  average_return: number;
  median_return: number;
  best_return: number;
  worst_return: number;
};

export type CompareItem = {
  code: string;
  name: string;
  total_return: number;
  max_drawdown: number;
  volatility: number;
  sharpe_ratio: number;
  nav: NavPoint[];
};

export type WatchlistItem = {
  code: string;
  name: string;
  fund_type?: string | null;
  manager?: string | null;
  latest_nav?: number | null;
  latest_nav_date?: string | null;
  asset_size_billion?: number | null;
};

export type CompareList = {
  id: string;
  name: string;
  codes: string[];
  created_at: string;
};

export type PortfolioHolding = {
  asset_type: "fund" | "index";
  code: string;
  weight: number;
};

export type PortfolioContribution = PortfolioHolding & {
  total_return: number;
  contribution: number;
};

export type PortfolioBacktestResponse = {
  initial_value: number;
  nav: NavPoint[];
  drawdowns: DrawdownPoint[];
  metrics: FundMetrics;
  contributions: PortfolioContribution[];
  rebalance_dates: string[];
  benchmark?: {
    asset_type: "fund" | "index";
    code: string;
    nav: NavPoint[];
    metrics: FundMetrics;
    excess_return: number;
    tracking_error: number;
    information_ratio: number;
  };
};
