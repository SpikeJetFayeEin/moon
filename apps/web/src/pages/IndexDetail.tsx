import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AdvancedMetricsPanel } from "../components/AdvancedMetricsPanel";
import { MetricCard } from "../components/MetricCard";
import { NavChart } from "../components/NavChart";
import { getIndex, getIndexMetrics, getIndexNav } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";

export function IndexDetail() {
  const { code = "ndx" } = useParams();
  const [startDate, setStartDate] = useState("");
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
  const metricsQuery = useQuery({
    queryKey: ["index-metrics", code, startDate, endDate, holdingDays],
    queryFn: () =>
      getIndexMetrics(code, {
        startDate,
        endDate,
        holdingDays,
      }),
  });

  const marketIndex = indexQuery.data;
  const nav = navQuery.data ?? [];
  const metrics = metricsQuery.data;
  const recentRows = useMemo(() => [...nav].reverse().slice(0, 8), [nav]);

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

      <section className="metric-grid">
        <MetricCard label="累计收益" value={formatPercent(metrics.total_return)} tone="good" />
        <MetricCard label="年化收益" value={formatPercent(metrics.annualized_return)} tone="good" />
        <MetricCard label="最大回撤" value={formatPercent(metrics.max_drawdown)} tone="bad" />
        <MetricCard label="年化波动" value={formatPercent(metrics.volatility)} />
        <MetricCard label="夏普比率" value={formatNumber(metrics.sharpe_ratio)} />
      </section>

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
    </main>
  );
}
