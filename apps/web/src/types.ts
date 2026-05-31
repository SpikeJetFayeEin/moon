export type Fund = {
  code: string;
  name: string;
  fund_type: string;
  manager: string;
  inception_date: string;
  latest_nav: number;
  latest_nav_date: string;
  asset_size_billion: number;
};

export type FundListResponse = {
  items: Fund[];
  total: number;
  page: number;
  page_size: number;
};

export type NavPoint = {
  date: string;
  nav: number;
  accumulated_nav?: number;
};

export type FundMetrics = {
  code: string;
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  volatility: number;
  sharpe_ratio: number;
  rolling_returns: Record<string, number[]>;
  calculated_at: string;
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
};

export type CompareList = {
  id: string;
  name: string;
  codes: string[];
  created_at: string;
};
