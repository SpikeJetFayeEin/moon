import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AdvancedMetricsPanel } from "../components/AdvancedMetricsPanel";
import { MetricCard } from "../components/MetricCard";
import { NavChart } from "../components/NavChart";
import { useSession } from "../hooks/useSession";
import { addWatchlistItem, getFund, getFundMetrics, getFundNav } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";

export function FundDetail() {
  const { code = "000300" } = useParams();
  const queryClient = useQueryClient();
  const { accessToken, session } = useSession();
  const [watchlistMessage, setWatchlistMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [holdingDays, setHoldingDays] = useState(30);
  const fundQuery = useQuery({ queryKey: ["fund", code], queryFn: () => getFund(code) });
  const navQuery = useQuery({ queryKey: ["fund-nav", code], queryFn: () => getFundNav(code) });
  const metricsQuery = useQuery({
    queryKey: ["fund-metrics", code, startDate, endDate, holdingDays],
    queryFn: () =>
      getFundMetrics(code, {
        startDate,
        endDate,
        holdingDays,
      }),
  });

  const fund = fundQuery.data;
  const nav = navQuery.data ?? [];
  const metrics = metricsQuery.data;
  const recentRows = useMemo(() => [...nav].reverse().slice(0, 8), [nav]);
  const saveWatchlistMutation = useMutation({
    mutationFn: () => addWatchlistItem(code, accessToken),
    onSuccess: async () => {
      setWatchlistMessage("已保存到自选");
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error) => {
      setWatchlistMessage(error instanceof Error ? error.message : "保存失败，请稍后重试");
    },
  });

  if (!fund || !metrics) {
    return <main className="page-grid">加载基金详情...</main>;
  }

  return (
    <main className="page-grid">
      <section className="detail-header">
        <div>
          <Link to="/" className="back-link">返回筛选</Link>
          <p className="eyebrow">{fund.code} · {fund.fund_type}</p>
          <h1>{fund.name}</h1>
          <p>
            管理人：{fund.manager} · 成立日：{fund.inception_date} · 最新净值：
            {formatNumber(fund.latest_nav, 4)}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="ghost-button"
            disabled={saveWatchlistMutation.isPending}
            onClick={() => {
              if (!session) {
                setWatchlistMessage("请先使用 Google 登录");
                return;
              }
              setWatchlistMessage("");
              saveWatchlistMutation.mutate();
            }}
          >
            {saveWatchlistMutation.isPending ? "保存中..." : "保存自选"}
          </button>
          <Link className="primary-button as-link" to={`/compare?codes=${fund.code},110022`}>
            加入对比
          </Link>
          {watchlistMessage ? <p className="muted-note">{watchlistMessage}</p> : null}
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
              <h2>净值走势</h2>
              <p>基于后端缓存的历史净值序列，生产环境由 AKShare 每日同步入库。</p>
            </div>
          </div>
          <NavChart data={nav} />
        </article>
        <article className="analysis-panel">
          <div className="panel-heading">
            <div>
              <h2>持有分析</h2>
              <p>在选定观察区间内，逐日模拟买入并持有指定天数后的收益分布。</p>
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
          <p>
            最大回撤衡量从历史高点下跌的最坏幅度；波动率和夏普用于评估收益质量。
          </p>
          <div className="risk-stack">
            <span>最大回撤 <strong>{formatPercent(metrics.max_drawdown)}</strong></span>
            <span>波动率 <strong>{formatPercent(metrics.volatility)}</strong></span>
            <span>夏普 <strong>{formatNumber(metrics.sharpe_ratio)}</strong></span>
          </div>
        </article>
        <AdvancedMetricsPanel metrics={metrics} />
        <article className="analysis-panel">
          <h2>滚动分析</h2>
          <p>第一版优先展示净值可计算的滚动收益，暂不做持仓穿透和因子暴露。</p>
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
                <th>单位净值</th>
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
