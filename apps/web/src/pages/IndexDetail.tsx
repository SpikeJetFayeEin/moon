import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdvancedMetricsPanel } from "../components/AdvancedMetricsPanel";
import { InsightPanel } from "../components/InsightPanel";
import { MetricCard } from "../components/MetricCard";
import { MetricStrip } from "../components/MetricStrip";
import { NavChart } from "../components/NavChart";
import { getIndex, getIndexDrawdowns, getIndexMetrics, getIndexNav } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { FundMetrics, NavPoint } from "../types";

const DEFAULT_INDEX_START_DATE = "2020-01-01";

export function IndexDetail() {
  const { code = "ndx" } = useParams();
  const [startDate, setStartDate] = useState(DEFAULT_INDEX_START_DATE);
  const [endDate, setEndDate] = useState("");
  const [holdingDays, setHoldingDays] = useState(30);
  const indexQuery = useQuery({
    queryKey: ["index", code],
    queryFn: () => getIndex(code),
  });
  const navQuery = useQuery({
    queryKey: ["index-nav", code],
    queryFn: () => getIndexNav(code),
  });
  const drawdownsQuery = useQuery({
    queryKey: ["index-drawdowns", code],
    queryFn: () => getIndexDrawdowns(code),
  });
  const metricsQuery = useQuery({
    queryKey: ["index-metrics", code, startDate, endDate, holdingDays],
    queryFn: () =>
      getIndexMetrics(code, {
        startDate,
        endDate,
        holdingDays,
      }),
  });
  const peerCode = code === "ndx" ? "spx" : "ndx";
  const peerMetricsQuery = useQuery({
    queryKey: ["index-metrics", peerCode, startDate, endDate, holdingDays],
    queryFn: () =>
      getIndexMetrics(peerCode, {
        startDate,
        endDate,
        holdingDays,
      }),
  });
  const peerIndexQuery = useQuery({
    queryKey: ["index", peerCode],
    queryFn: () => getIndex(peerCode),
  });

  const marketIndex = indexQuery.data;
  const nav = navQuery.data ?? [];
  const drawdowns = drawdownsQuery.data ?? [];
  const metrics = metricsQuery.data;
  const peerMetrics = peerMetricsQuery.data;
  const peerIndex = peerIndexQuery.data;
  const recentRows = useMemo(() => [...nav].reverse().slice(0, 8), [nav]);
  const metricEndDate = endDate || marketIndex?.latest_date || "最新";
  const returnSeries = useMemo(() => buildReturnSeries(nav), [nav]);
  const periodRows = useMemo(() => buildIndexPeriodRows(metrics), [metrics]);
  const yearlyRows = useMemo(() => buildYearlyRows(metrics), [metrics]);

  if (!marketIndex || !metrics) {
    return <main className="page-grid">加载指数详情...</main>;
  }

  return (
    <main className="page-grid">
      <section className="detail-header">
        <div>
          <Link to="/" className="back-link">返回筛选</Link>
          <p className="eyebrow">
            {marketIndex.symbol} · {marketIndex.return_type === "total_return" ? "全收益" : "价格"}
          </p>
          <h1>{marketIndex.name}</h1>
          <p>
            {marketIndex.description} 数据源：{marketIndex.provider} · 最新点位：
            {formatNumber(marketIndex.latest_value, 2)}（{marketIndex.latest_date}）
          </p>
        </div>
        <div className="index-source-card">
          <span>指数序列</span>
          <strong>含分红再投资</strong>
          <small>页面展示为 1.0000 起始的归一化净值</small>
        </div>
      </section>

      <MetricStrip
        items={[
          { label: "累计收益", value: formatPercent(metrics.total_return), tone: "good" },
          { label: "年化收益", value: formatPercent(metrics.annualized_return), tone: "good" },
          { label: "最大回撤", value: formatPercent(metrics.max_drawdown), tone: "bad" },
          { label: "年化波动", value: formatPercent(metrics.volatility) },
          { label: "持有胜率", value: formatPercent(metrics.holding_analysis.win_rate), tone: "accent" },
          { label: "数据更新", value: marketIndex.latest_date },
        ]}
      />

      <section className="metric-grid">
        <MetricCard label="累计收益" value={formatPercent(metrics.total_return)} tone="good" />
        <MetricCard label="年化收益" value={formatPercent(metrics.annualized_return)} tone="good" />
        <MetricCard label="最大回撤" value={formatPercent(metrics.max_drawdown)} tone="bad" />
        <MetricCard label="年化波动" value={formatPercent(metrics.volatility)} />
        <MetricCard label="夏普比率" value={formatNumber(metrics.sharpe_ratio)} />
        <MetricCard label="持有胜率" value={formatPercent(metrics.holding_analysis.win_rate)} />
      </section>
      <p className="metric-period-note">
        当前收益区间：{startDate || "序列首日"} 至 {metricEndDate}
      </p>

      <section className="analysis-layout">
        <article className="analysis-panel wide">
          <div className="panel-heading">
            <div>
              <h2>全收益净值走势</h2>
              <p>原始序列为全收益指数点位，后端按首日点位归一化，便于和基金净值口径一致。</p>
            </div>
          </div>
          <NavChart data={nav} />
        </article>
        <article className="analysis-panel">
          <h2>阶段收益</h2>
          <p>阶段收益和回撤均按全收益归一化净值计算，和基金详情页口径一致。</p>
          <table>
            <thead>
              <tr>
                <th>区间</th>
                <th>收益</th>
                <th>最大回撤</th>
              </tr>
            </thead>
            <tbody>
              {periodRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={row.returnRate != null && row.returnRate >= 0 ? "positive" : "negative"}>
                    {formatMaybePercent(row.returnRate)}
                  </td>
                  <td>{formatMaybePercent(row.maxDrawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="analysis-panel wide">
          <h2>累计收益与回撤</h2>
          <div className="chart-two-col embedded">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={returnSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5edf7" />
                <XAxis dataKey="date" minTickGap={42} />
                <YAxis tickFormatter={(value) => `${Number(value * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value) => formatPercent(Number(value))} />
                <Line type="monotone" dataKey="returnRate" name="累计收益" stroke="#2563eb" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={drawdowns}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5edf7" />
                <XAxis dataKey="date" minTickGap={42} />
                <YAxis tickFormatter={(value) => `${Number(value * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value) => formatPercent(Number(value))} />
                <Area type="monotone" dataKey="drawdown" name="回撤" stroke="#2563eb" fill="#dbeafe" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="analysis-panel">
          <div className="panel-heading">
            <div>
              <h2>持有分析</h2>
              <p>在选定观察区间内，逐日模拟买入全收益指数并持有指定天数后的收益分布。</p>
            </div>
          </div>
          <div className="holding-controls">
            <label>
              开始日期
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              结束日期
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <label>
              持有周期
              <select
                value={holdingDays}
                onChange={(event) => setHoldingDays(Number(event.target.value))}
              >
                <option value={7}>7 天</option>
                <option value={30}>30 天</option>
                <option value={90}>90 天</option>
                <option value={180}>180 天</option>
                <option value={365}>365 天</option>
              </select>
            </label>
          </div>
          <div className="risk-stack">
            <span>
              持有胜率 <strong>{formatPercent(metrics.holding_analysis.win_rate)}</strong>
            </span>
            <span>
              平均持有收益{" "}
              <strong>{formatPercent(metrics.holding_analysis.average_return)}</strong>
            </span>
            <span>
              中位数收益{" "}
              <strong>{formatPercent(metrics.holding_analysis.median_return)}</strong>
            </span>
            <span>
              最好 / 最差{" "}
              <strong>
                {formatPercent(metrics.holding_analysis.best_return)} /{" "}
                {formatPercent(metrics.holding_analysis.worst_return)}
              </strong>
            </span>
            <span>
              样本数 <strong>{metrics.holding_analysis.sample_count}</strong>
            </span>
          </div>
          {metricsQuery.isFetching ? <p className="muted-note">正在更新持有分析...</p> : null}
        </article>
        <article className="analysis-panel">
          <h2>风险回撤</h2>
          <p>最大回撤、波动率和夏普比率均基于全收益归一化净值计算。</p>
          <div className="risk-stack">
            <span>最大回撤 <strong>{formatPercent(metrics.max_drawdown)}</strong></span>
            <span>波动率 <strong>{formatPercent(metrics.volatility)}</strong></span>
            <span>夏普 <strong>{formatNumber(metrics.sharpe_ratio)}</strong></span>
          </div>
        </article>
        <article className="analysis-panel wide">
          <h2>纳指100与标普500对比</h2>
          <p>
            使用相同观察区间和全收益口径。当前对比对象：
            {marketIndex.name} vs {peerIndex?.name ?? peerCode.toUpperCase()}。
          </p>
          <table>
            <thead>
              <tr>
                <th>指数</th>
                <th>累计收益</th>
                <th>年化收益</th>
                <th>最大回撤</th>
                <th>年化波动</th>
                <th>夏普</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: marketIndex.name, metrics },
                { name: peerIndex?.name ?? peerCode.toUpperCase(), metrics: peerMetrics },
              ].map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{formatMaybePercent(row.metrics?.total_return)}</td>
                  <td>{formatMaybePercent(row.metrics?.annualized_return)}</td>
                  <td>{formatMaybePercent(row.metrics?.max_drawdown)}</td>
                  <td>{formatMaybePercent(row.metrics?.volatility)}</td>
                  <td>{formatNumber(row.metrics?.sharpe_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="analysis-panel">
          <h2>年度收益</h2>
          <p>按自然年统计首尾全收益净值变化，用于观察指数收益集中年份。</p>
          <table>
            <thead>
              <tr>
                <th>年份</th>
                <th>收益</th>
              </tr>
            </thead>
            <tbody>
              {yearlyRows.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td className={row.returnRate >= 0 ? "positive" : "negative"}>
                    {formatPercent(row.returnRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <AdvancedMetricsPanel metrics={metrics} />
        <article className="analysis-panel">
          <h2>滚动分析</h2>
          <p>展示不同交易日窗口的滚动收益，便于观察指数阶段表现稳定性。</p>
          {Object.entries(metrics.rolling_returns).map(([window, values]) => (
            <div className="rolling-row" key={window}>
              <span>{window} 日滚动收益</span>
              <strong>{formatPercent(values[values.length - 1] ?? 0)}</strong>
            </div>
          ))}
        </article>
        <article className="analysis-panel wide">
          <h2>历史数据</h2>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>归一化净值</th>
                <th>累计净值</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{formatNumber(point.nav, 4)}</td>
                  <td>{formatNumber(point.accumulated_nav ?? point.nav, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
      <InsightPanel
        title="指数口径说明"
        description="指数页面使用全收益口径，便于与基金净值表现统一比较。"
        items={[
          { label: "指数来源", value: marketIndex.provider, detail: marketIndex.symbol },
          { label: "收益口径", value: marketIndex.return_type === "total_return" ? "全收益" : "价格", detail: "含分红再投资时标注为全收益" },
          { label: "归一化", value: "首日 1.0000", detail: "图表展示统一净值起点" },
        ]}
        footnote="指数分析不构成投资建议；不同币种、交易日和数据源会影响比较口径。"
      />
    </main>
  );
}

function buildReturnSeries(nav: NavPoint[]): Array<{ date: string; returnRate: number }> {
  const first = nav[0];
  const base = first?.accumulated_nav ?? first?.nav;
  if (!base) return [];
  return nav.map((point) => ({
    date: point.date,
    returnRate: ((point.accumulated_nav ?? point.nav) / base) - 1,
  }));
}

function buildIndexPeriodRows(metrics: FundMetrics | undefined) {
  return [
    { label: "近一周", returnRate: metrics?.period_returns["1w"] ?? null, maxDrawdown: metrics?.period_drawdowns["1w"] ?? null },
    { label: "近一月", returnRate: metrics?.period_returns["1m"] ?? null, maxDrawdown: metrics?.period_drawdowns["1m"] ?? null },
    { label: "近三月", returnRate: metrics?.period_returns["3m"] ?? null, maxDrawdown: metrics?.period_drawdowns["3m"] ?? null },
    { label: "近半年", returnRate: metrics?.period_returns["6m"] ?? null, maxDrawdown: metrics?.period_drawdowns["6m"] ?? null },
    { label: "近一年", returnRate: metrics?.period_returns["1y"] ?? null, maxDrawdown: metrics?.period_drawdowns["1y"] ?? null },
    { label: "近三年", returnRate: metrics?.period_returns["3y"] ?? null, maxDrawdown: metrics?.period_drawdowns["3y"] ?? null },
    { label: "近五年", returnRate: metrics?.period_returns["5y"] ?? null, maxDrawdown: metrics?.period_drawdowns["5y"] ?? null },
    { label: "区间以来", returnRate: metrics?.period_returns.since_inception ?? null, maxDrawdown: metrics?.period_drawdowns.since_inception ?? null },
  ];
}

function buildYearlyRows(metrics: FundMetrics | undefined) {
  return Object.entries(metrics?.yearly_returns ?? {})
    .sort(([left], [right]) => Number(right) - Number(left))
    .map(([year, returnRate]) => ({ year, returnRate }));
}

function formatMaybePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "暂无" : formatPercent(value);
}
