import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AdvancedMetricsPanel } from "../components/AdvancedMetricsPanel";
import {
  DrawdownAreaChart,
  NormalizedReturnChart,
  YearlyReturnBarChart,
} from "../components/AnalyticsCharts";
import { MetricStrip } from "../components/MetricStrip";
import { QueryStatePanel } from "../components/QueryStatePanel";
import {
  getFund,
  getFundDrawdowns,
  getFundMetrics,
  getFundNav,
  getFundPerformance,
  getFundProfile,
  getIndex,
  getIndexDrawdowns,
  getIndexMetrics,
  getIndexNav,
} from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { Fund, FundMetrics, FundPerformanceItem, MarketIndex, NavPoint } from "../types";

export function AssetAnalysis() {
  const { assetType = "fund", code = "000300" } = useParams();
  const isIndex = assetType === "index";
  const [holdingDays, setHoldingDays] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fundQuery = useQuery({
    enabled: !isIndex,
    queryKey: ["analysis-fund", code],
    queryFn: () => getFund(code),
  });
  const profileQuery = useQuery({
    enabled: !isIndex,
    queryKey: ["analysis-fund-profile", code],
    queryFn: () => getFundProfile(code),
  });
  const performanceQuery = useQuery({
    enabled: !isIndex,
    queryKey: ["analysis-fund-performance", code],
    queryFn: () => getFundPerformance(code),
  });
  const indexQuery = useQuery({
    enabled: isIndex,
    queryKey: ["analysis-index", code],
    queryFn: () => getIndex(code),
  });
  const navQuery = useQuery({
    queryKey: ["analysis-nav", assetType, code],
    queryFn: () => (isIndex ? getIndexNav(code) : getFundNav(code)),
  });
  const drawdownsQuery = useQuery({
    queryKey: ["analysis-drawdowns", assetType, code],
    queryFn: () => (isIndex ? getIndexDrawdowns(code) : getFundDrawdowns(code)),
  });
  const metricsQuery = useQuery({
    queryKey: ["analysis-metrics", assetType, code, startDate, endDate, holdingDays],
    queryFn: () =>
      isIndex
        ? getIndexMetrics(code, { startDate, endDate, holdingDays })
        : getFundMetrics(code, { startDate, endDate, holdingDays }),
  });

  const asset = isIndex ? indexQuery.data : fundQuery.data;
  const nav = navQuery.data ?? [];
  const metrics = metricsQuery.data;
  const drawdowns = drawdownsQuery.data ?? [];
  const yearlyRows = useMemo(() => buildYearlyRows(metrics), [metrics]);
  const periodRows = useMemo(
    () => buildPeriodRows(metrics, performanceQuery.data ?? [], isIndex),
    [isIndex, metrics, performanceQuery.data],
  );
  const latestNav = nav[nav.length - 1];

  if (metricsQuery.isLoading || navQuery.isLoading || (!isIndex && fundQuery.isLoading) || (isIndex && indexQuery.isLoading)) {
    return (
      <main className="asset-analysis">
        <QueryStatePanel title="正在加载多维度分析" description={`正在读取 ${code} 的净值、回撤和指标。`} tone="loading" />
      </main>
    );
  }

  if (!asset || !metrics || metricsQuery.isError || navQuery.isError) {
    return (
      <main className="asset-analysis">
        <QueryStatePanel title="分析数据加载失败" description="请确认资产代码存在，或先在数据同步看板执行同步。" tone="error" />
      </main>
    );
  }

  return (
    <main className="asset-analysis">
      <section className="analysis-hero">
        <div>
          <Link className="back-link" to="/">返回数据同步</Link>
          <p className="eyebrow">{isIndex ? "Index Analysis" : "Fund Analysis"}</p>
          <h1>{asset.name}</h1>
          <p>{isIndex ? (asset as MarketIndex).description : profileQuery.data?.benchmark ?? "基于净值序列、回撤、持有体验和收益质量分析单个基金。"}</p>
        </div>
        <div className="analysis-controls">
          <label>
            开始日期
            <input max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          </label>
          <label>
            结束日期
            <input min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          </label>
          <label>
            持有周期
            <select onChange={(event) => setHoldingDays(Number(event.target.value))} value={holdingDays}>
              <option value={7}>7 天</option>
              <option value={30}>30 天</option>
              <option value={90}>90 天</option>
              <option value={180}>180 天</option>
              <option value={365}>365 天</option>
            </select>
          </label>
        </div>
      </section>

      <MetricStrip
        items={[
          { label: "最新净值/点位", value: formatLatest(asset, latestNav), detail: latestNav?.date ?? latestDate(asset, isIndex) },
          { label: "累计收益", value: formatPercent(metrics.total_return), tone: metrics.total_return >= 0 ? "good" : "bad" },
          { label: "年化收益", value: formatPercent(metrics.annualized_return), tone: metrics.annualized_return >= 0 ? "good" : "bad" },
          { label: "最大回撤", value: formatPercent(metrics.max_drawdown), tone: "bad" },
          { label: "夏普比率", value: formatNumber(metrics.sharpe_ratio), tone: "accent" },
        ]}
      />

      <section className="analysis-grid">
        <article className="analysis-panel wide">
          <div className="panel-heading">
            <div>
              <h2>多维度分析</h2>
              <p>收益、回撤、年度表现和持有体验都来自同一只资产的净值序列。</p>
            </div>
            <span className="sync-status">{nav.length} 个净值点</span>
          </div>
          <NormalizedReturnChart series={[{ name: asset.name, nav }]} height={320} />
        </article>

        <article className="analysis-panel">
          <h2>回撤路径</h2>
          <DrawdownAreaChart data={drawdowns} height={260} />
        </article>

        <article className="analysis-panel">
          <h2>年度收益</h2>
          <YearlyReturnBarChart data={yearlyRows} height={260} />
        </article>

        <article className="analysis-panel">
          <h2>阶段表现</h2>
          <table>
            <thead>
              <tr>
                <th>区间</th>
                <th>收益</th>
                <th>最大回撤</th>
                <th>排名</th>
              </tr>
            </thead>
            <tbody>
              {periodRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={row.returnRate != null && row.returnRate >= 0 ? "up" : "down"}>{formatMaybePercent(row.returnRate)}</td>
                  <td>{formatMaybePercent(row.maxDrawdown)}</td>
                  <td>{row.rank ?? "暂无"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <AdvancedMetricsPanel metrics={metrics} />

        <article className="analysis-panel">
          <h2>持有体验</h2>
          <div className="risk-stack">
            <span>持有周期 <strong>{metrics.holding_analysis.holding_days} 天</strong></span>
            <span>样本数量 <strong>{metrics.holding_analysis.sample_count}</strong></span>
            <span>胜率 <strong>{formatPercent(metrics.holding_analysis.win_rate)}</strong></span>
            <span>平均收益 <strong>{formatPercent(metrics.holding_analysis.average_return)}</strong></span>
            <span>中位数收益 <strong>{formatPercent(metrics.holding_analysis.median_return)}</strong></span>
            <span>最好 / 最差 <strong>{formatPercent(metrics.holding_analysis.best_return)} / {formatPercent(metrics.holding_analysis.worst_return)}</strong></span>
          </div>
        </article>

        <article className="analysis-panel">
          <h2>基础数据</h2>
          <AssetFacts asset={asset} isIndex={isIndex} />
        </article>
      </section>
    </main>
  );
}

function AssetFacts({ asset, isIndex }: { asset: Fund | MarketIndex; isIndex: boolean }) {
  if (isIndex) {
    const marketIndex = asset as MarketIndex;
    return (
      <div className="risk-stack">
        <span>代码 <strong>{marketIndex.code}</strong></span>
        <span>符号 <strong>{marketIndex.symbol}</strong></span>
        <span>收益口径 <strong>{marketIndex.return_type}</strong></span>
        <span>币种 <strong>{marketIndex.currency}</strong></span>
        <span>数据源 <strong>{marketIndex.provider}</strong></span>
        <span>最新日期 <strong>{marketIndex.latest_date}</strong></span>
      </div>
    );
  }

  const fund = asset as Fund;
  return (
    <div className="risk-stack">
      <span>代码 <strong>{fund.code}</strong></span>
      <span>类型 <strong>{fund.fund_type}</strong></span>
      <span>管理人 <strong>{fund.manager}</strong></span>
      <span>基金经理 <strong>{fund.fund_manager ?? "待同步"}</strong></span>
      <span>成立日期 <strong>{fund.inception_date}</strong></span>
      <span>规模 <strong>{formatNumber(fund.asset_size_billion, 2)} 亿</strong></span>
    </div>
  );
}

function buildYearlyRows(metrics: FundMetrics | undefined) {
  return Object.entries(metrics?.yearly_returns ?? {})
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([year, returnRate]) => ({ year, returnRate }));
}

function buildPeriodRows(
  metrics: FundMetrics | undefined,
  performance: FundPerformanceItem[],
  isIndex: boolean,
) {
  if (!isIndex && performance.length) {
    return performance.slice(0, 8).map((item) => ({
      label: item.period,
      returnRate: item.return_rate ?? null,
      maxDrawdown: item.max_drawdown ?? null,
      rank: item.rank ?? null,
    }));
  }
  return [
    { label: "近一周", returnRate: metrics?.period_returns["1w"] ?? null, maxDrawdown: metrics?.period_drawdowns["1w"] ?? null, rank: null },
    { label: "近一月", returnRate: metrics?.period_returns["1m"] ?? null, maxDrawdown: metrics?.period_drawdowns["1m"] ?? null, rank: null },
    { label: "近三月", returnRate: metrics?.period_returns["3m"] ?? null, maxDrawdown: metrics?.period_drawdowns["3m"] ?? null, rank: null },
    { label: "近半年", returnRate: metrics?.period_returns["6m"] ?? null, maxDrawdown: metrics?.period_drawdowns["6m"] ?? null, rank: null },
    { label: "近一年", returnRate: metrics?.period_returns["1y"] ?? null, maxDrawdown: metrics?.period_drawdowns["1y"] ?? null, rank: null },
    { label: "近三年", returnRate: metrics?.period_returns["3y"] ?? null, maxDrawdown: metrics?.period_drawdowns["3y"] ?? null, rank: null },
  ];
}

function latestDate(asset: { latest_nav_date?: string | null; latest_date?: string }, isIndex: boolean) {
  return isIndex ? asset.latest_date : asset.latest_nav_date ?? "暂无日期";
}

function formatLatest(asset: { latest_nav?: number | null; latest_value?: number }, latestNav: NavPoint | undefined) {
  return formatNumber(asset.latest_value ?? asset.latest_nav ?? latestNav?.nav, 4);
}

function formatMaybePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "暂无" : formatPercent(value);
}
