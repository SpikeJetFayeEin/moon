export type Fund = {
  code: string;
  name: string;
  fund_type: string;
  manager: string;
  fund_manager?: string | null;
  inception_date: string;
  latest_nav: number | null;
  latest_nav_date: string | null;
  asset_size_billion: number | null;
  return_1m?: number | null;
  drawdown_1m?: number | null;
  return_1y?: number | null;
  drawdown_1y?: number | null;
  max_drawdown?: number | null;
  volatility?: number | null;
  sharpe_ratio?: number | null;
};

export type FundListResponse = {
  items: Fund[];
  total: number;
  page: number;
  page_size: number;
};

export type FundManager = {
  manager_id: string;
  name: string;
  company: string;
  source: string;
  active_product_count: number;
  synced_at: string;
};

export type FundManagerListResponse = {
  items: FundManager[];
  total: number;
};

export type FundManagerSyncResponse = {
  managers_seen: number;
  tenures_seen: number;
  synced_at: string;
  status: "synced" | "skipped";
};

export type FundManagerComparisonPeriod = "1m" | "3m" | "6m" | "1y" | "3y";

export type FundManagerProductComparisonItem = {
  code: string;
  name: string;
  fund_type?: string | null;
  asset_size_billion?: number | null;
  latest_nav_date?: string | null;
  return_rate?: number | null;
  annualized_return?: number | null;
  volatility?: number | null;
  max_drawdown?: number | null;
  sharpe_ratio?: number | null;
  nav: NavPoint[];
  status: "ready" | "pending_data";
};

export type FundManagerProductComparison = {
  manager_id: string;
  period: FundManagerComparisonPeriod;
  items: FundManagerProductComparisonItem[];
};

export type FundProfile = {
  code: string;
  name: string;
  full_name?: string | null;
  fund_company?: string | null;
  fund_manager?: string | null;
  custodian?: string | null;
  fund_type?: string | null;
  inception_date?: string | null;
  asset_size_billion?: number | null;
  rating_source?: string | null;
  rating?: string | null;
  investment_strategy?: string | null;
  investment_target?: string | null;
  benchmark?: string | null;
};

export type FundPerformanceItem = {
  performance_type: "stage" | "year" | string;
  period: string;
  return_rate?: number | null;
  max_drawdown?: number | null;
  rank?: string | null;
};

export type FundPerformanceResponse = {
  code: string;
  items: FundPerformanceItem[];
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

export type SyncResponse = {
  asset_type: "fund" | "index";
  code: string;
  items_seen: number;
  nav_rows_seen: number;
  synced_at: string;
  status: "synced" | "skipped";
};

export type DeleteSyncResponse = {
  asset_type: "fund" | "index";
  code: string;
  deleted: boolean;
  status: "deleted" | "missing";
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

export type DrawdownSeriesResponse = {
  code: string;
  items: DrawdownPoint[];
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
  period_drawdowns: Record<string, number | null>;
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
