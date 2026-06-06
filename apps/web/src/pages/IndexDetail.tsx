import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  DrawdownAreaChart,
  NormalizedReturnChart,
  YearlyReturnBarChart,
} from "../components/AnalyticsCharts";
import { QueryStatePanel } from "../components/QueryStatePanel";
import { getIndex, getIndexDrawdowns, getIndexMetrics, getIndexNav } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { FundMetrics } from "../types";

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
  const peerNavQuery = useQuery({
    queryKey: ["index-nav", peerCode],
    queryFn: () => getIndexNav(peerCode),
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
  const peerNav = peerNavQuery.data ?? [];
  const peerIndex = peerIndexQuery.data;
  const periodRows = useMemo(() => buildIndexPeriodRows(metrics), [metrics]);
  const yearlyRows = useMemo(() => buildYearlyRows(metrics), [metrics]);
  const yearlyChartRows = useMemo(() => [...yearlyRows].reverse(), [yearlyRows]);
  const comparisonRows = useMemo(
    () => [
      { name: marketIndex?.name ?? code.toUpperCase(), metrics },
      { name: peerIndex?.name ?? peerCode.toUpperCase(), metrics: peerMetrics },
    ],
    [code, marketIndex?.name, metrics, peerCode, peerIndex?.name, peerMetrics],
  );
  const excessReturn =
    metrics && peerMetrics ? metrics.total_return - peerMetrics.total_return : null;

  if (indexQuery.isLoading || metricsQuery.isLoading) {
    return (
      <main className="terminal-page">
        <section className="terminal-main">
          <QueryStatePanel title="正在加载指数详情" description={`正在读取 ${code.toUpperCase()} 的全收益序列和风险指标。`} tone="loading" />
        </section>
      </main>
    );
  }

  if (indexQuery.isError || metricsQuery.isError || !marketIndex || !metrics) {
    return (
      <main className="terminal-page">
        <section className="terminal-main">
          <QueryStatePanel
            title="指数详情加载失败"
            description="未能读取该指数的净值或指标数据；请切换指数或稍后重试。"
            tone="error"
          />
        </section>
      </main>
    );
  }

  return (
    <main className="terminal-page">
      <aside className="terminal-rail">
        <div className="terminal-title-row">
          <h2>指数筛选</h2>
          <span className="badge">重置</span>
        </div>
        <div className="terminal-filter-group">
          <div className="terminal-filter-title">指数类型</div>
          {["宽基指数", "行业指数", "主题指数", "策略指数", "海外指数"].map((item, index) => (
            <label className="terminal-check" key={item}>
              <input defaultChecked={index < 2} disabled type="checkbox" />
              {item}
            </label>
          ))}
        </div>
        <label>
          市场
          <select defaultValue="all" disabled>
            <option value="all">全部市场</option>
            <option value="cn">A股</option>
            <option value="us">美股</option>
          </select>
        </label>
        <label>
          估值分位
          <select defaultValue="all" disabled>
            <option value="all">全部分位</option>
            <option value="low">低估值</option>
            <option value="high">高估值</option>
          </select>
        </label>
        <label>
          开始日期
          <input
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </label>
        <label>
          结束日期
          <input
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
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
        <button className="primary-button" type="button">应用观察区间</button>
        <button className="ghost-button" disabled type="button">保存筛选（待接入）</button>
      </aside>

      <section className="terminal-main">
        <section className="overview">
          <article className="terminal-card">
            <div className="terminal-title-row">
              <h2>市场概览 <span className="hint">（{marketIndex.latest_date}）</span></h2>
              <Link to="/" className="hint">返回筛选</Link>
            </div>
            <div className="terminal-kpi-grid">
              <div className="terminal-kpi">
                <span>{marketIndex.name}</span>
                <strong>{formatNumber(marketIndex.latest_value, 2)}</strong>
                <b className={metrics.total_return >= 0 ? "up" : "down"}>{formatPercent(metrics.total_return)}</b>
              </div>
              <div className="terminal-kpi">
                <span>{peerIndex?.name ?? peerCode.toUpperCase()}</span>
                <strong>{formatNumber(peerIndex?.latest_value, 2)}</strong>
                <b className={peerMetrics && peerMetrics.total_return >= 0 ? "up" : "down"}>{formatMaybePercent(peerMetrics?.total_return)}</b>
              </div>
              <div className="terminal-kpi">
                <span>年化收益</span>
                <strong className="up">{formatPercent(metrics.annualized_return)}</strong>
              </div>
              <div className="terminal-kpi">
                <span>最大回撤</span>
                <strong className="down">{formatPercent(metrics.max_drawdown)}</strong>
              </div>
              <div className="terminal-kpi">
                <span>超额收益</span>
                <strong className={excessReturn != null && excessReturn >= 0 ? "up" : "down"}>
                  {formatMaybePercent(excessReturn)}
                </strong>
              </div>
            </div>
          </article>
          <article className="terminal-card">
            <div className="terminal-title-row">
              <h2>指数口径</h2>
            </div>
            <div className="money">
              <div><span>数据源</span><strong>{marketIndex.provider}</strong></div>
              <div><span>收益口径</span><strong>{marketIndex.return_type === "total_return" ? "全收益" : "价格"}</strong></div>
            </div>
            <p>图表按首日归一化净值展示；全收益口径包含分红再投资。</p>
          </article>
        </section>

        <section className="terminal-table">
          <div className="terminal-tabs">
            <span className="active">指数列表</span>
            <span>阶段收益</span>
            <span>风险指标</span>
            <span>持有分析</span>
            <span>数据口径</span>
          </div>
          <div className="terminal-table-header">
            <span className="hint">当前指数与基准对比</span>
            <span className="hint">排序：近1年收益　⇩ 导出</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>代码</th>
                <th>指数名称</th>
                <th>指数公司</th>
                <th>类型</th>
                <th>点位</th>
                <th>累计收益</th>
                <th>年化收益</th>
                <th>最大回撤</th>
                <th>夏普</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name === marketIndex.name ? marketIndex.symbol : peerIndex?.symbol}</td>
                  <td>{row.name}</td>
                  <td>{row.name === marketIndex.name ? marketIndex.provider : peerIndex?.provider}</td>
                  <td>{marketIndex.return_type === "total_return" ? "全收益" : "价格"}</td>
                  <td>{formatNumber(row.name === marketIndex.name ? marketIndex.latest_value : peerIndex?.latest_value, 2)}</td>
                  <td className={row.metrics && row.metrics.total_return >= 0 ? "up" : "down"}>{formatMaybePercent(row.metrics?.total_return)}</td>
                  <td className={row.metrics && row.metrics.annualized_return >= 0 ? "up" : "down"}>{formatMaybePercent(row.metrics?.annualized_return)}</td>
                  <td className="down">{formatMaybePercent(row.metrics?.max_drawdown)}</td>
                  <td>{formatNumber(row.metrics?.sharpe_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="terminal-chart-grid">
          <article className="terminal-card terminal-chart">
            <div className="terminal-title-row">
              <h2>累计收益对比</h2>
              <span className="hint">近3年</span>
            </div>
            <NormalizedReturnChart
              height={225}
              series={[
                { name: marketIndex.name, color: "#0b72f0", nav },
                { name: peerIndex?.name ?? peerCode.toUpperCase(), color: "#ff8a1c", nav: peerNav },
              ]}
            />
          </article>
          <article className="terminal-card terminal-chart">
            <div className="terminal-title-row">
              <h2>阶段收益</h2>
              <span className="hint">同口径</span>
            </div>
            <table>
              <tbody>
                {periodRows.slice(0, 5).map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={row.returnRate != null && row.returnRate >= 0 ? "up" : "down"}>
                      {formatMaybePercent(row.returnRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article className="terminal-card terminal-chart">
            <div className="terminal-title-row">
              <h2>年度收益</h2>
              <span className="hint">%</span>
            </div>
            <YearlyReturnBarChart data={yearlyChartRows} height={225} />
          </article>
          <article className="terminal-card terminal-chart">
            <div className="terminal-title-row">
              <h2>回撤路径</h2>
              <span className="hint">压力阶段</span>
            </div>
            <DrawdownAreaChart data={drawdowns} height={225} />
          </article>
        </section>
      </section>

      <aside className="terminal-right">
        <div className="terminal-title-row">
          <h2>市场与风格洞察</h2>
          <span className="hint">ⓘ</span>
        </div>
        <div className="terminal-insight-list">
          <div className="terminal-insight-row"><span>收益领先</span><b>{marketIndex.symbol}</b><strong className="up">{formatMaybePercent(excessReturn)}</strong></div>
          <div className="terminal-insight-row"><span>持有胜率</span><b>{holdingDays}天</b><strong>{formatPercent(metrics.holding_analysis.win_rate)}</strong></div>
          <div className="terminal-insight-row"><span>日胜率</span><b>样本</b><strong>{formatPercent(metrics.positive_day_rate)}</strong></div>
          <div className="terminal-insight-row"><span>下行波动</span><b>风险</b><strong className="down">{formatPercent(metrics.downside_volatility)}</strong></div>
        </div>
        <div className="terminal-card">
          <h2>持有分析样本</h2>
          <div className="donut-row text-only">
            <div className="rank-list">
              <div>样本数　{metrics.holding_analysis.sample_count}</div>
              <div>平均收益　{formatPercent(metrics.holding_analysis.average_return)}</div>
              <div>中位数收益　{formatPercent(metrics.holding_analysis.median_return)}</div>
              <div>最好 / 最差　{formatPercent(metrics.holding_analysis.best_return)} / {formatPercent(metrics.holding_analysis.worst_return)}</div>
            </div>
          </div>
        </div>
        <div className="terminal-note-box">
          数据源：{marketIndex.provider}；指数估值、行业分布和资金流等待后端接口接入，当前不展示模拟数值。
        </div>
      </aside>
    </main>
  );
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
