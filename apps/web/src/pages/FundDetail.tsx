import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

import { useSession } from "../hooks/useSession";
import {
  addWatchlistItem,
  getFund,
  getFundDrawdowns,
  getFundMetrics,
  getFundNav,
  getFundPerformance,
  getFundProfile,
} from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { FundMetrics, FundPerformanceItem, NavPoint } from "../types";

type ReturnPoint = {
  date: string;
  fund: number;
};

type PeriodRow = {
  label: string;
  value: number | null;
  maxDrawdown: number | null;
  rank: string | null;
};

type PerformanceMode = "stage" | "year";

export function FundDetail() {
  const { code = "000300" } = useParams();
  const queryClient = useQueryClient();
  const { accessToken, session } = useSession();
  const [watchlistMessage, setWatchlistMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [holdingDays, setHoldingDays] = useState(30);
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>("stage");
  const fundQuery = useQuery({ queryKey: ["fund", code], queryFn: () => getFund(code) });
  const profileQuery = useQuery({
    queryKey: ["fund-profile", code],
    queryFn: () => getFundProfile(code),
  });
  const performanceQuery = useQuery({
    queryKey: ["fund-performance", code],
    queryFn: () => getFundPerformance(code),
  });
  const navQuery = useQuery({ queryKey: ["fund-nav", code], queryFn: () => getFundNav(code) });
  const drawdownsQuery = useQuery({
    queryKey: ["fund-drawdowns", code],
    queryFn: () => getFundDrawdowns(code),
  });
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
  const profile = profileQuery.data;
  const nav = navQuery.data ?? [];
  const metrics = metricsQuery.data;
  const latestNav = nav.length ? nav[nav.length - 1] : undefined;
  const previousNav = nav.length > 1 ? nav[nav.length - 2] : undefined;
  const latestDataDate = latestNav?.date ?? fund?.latest_nav_date ?? null;
  const dailyReturn =
    latestNav && previousNav
      ? (latestNav.accumulated_nav ?? latestNav.nav) /
          (previousNav.accumulated_nav ?? previousNav.nav) -
        1
      : null;
  const returnSeries = useMemo(() => buildReturnSeries(nav), [nav]);
  const drawdownSeries = drawdownsQuery.data ?? [];
  const rollingSeries = useMemo(
    () => buildRollingSeries(nav, metrics?.rolling_returns["180"] ?? []),
    [metrics?.rolling_returns, nav],
  );
  const periodRows = useMemo(
    () => buildPeriodRows(metrics, performanceQuery.data ?? [], performanceMode),
    [metrics, performanceMode, performanceQuery.data],
  );
  const recentRows = useMemo(() => [...nav].reverse().slice(0, 10), [nav]);
  const riskLevel = useMemo(() => inferRiskLevel(fund?.fund_type ?? ""), [fund?.fund_type]);
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
    <main className="fund-terminal">
      <aside className="fund-nav-menu">
        <a className="menu-group active" href="#basicInfo">基本信息</a>
        <a href="#basicInfo">基本信息</a>
        <a className="menu-group" href="#performance">业绩总览</a>
        <a href="#performance">累计收益走势</a>
        <a href="#periodReturns">阶段涨幅</a>
        <a href="#rollingReturn">滚动收益曲线</a>
        <a href="#drawdown">回撤曲线</a>
        <a href="#riskMetrics">收益指标</a>
        <a className="menu-group" href="#holdings">持仓分析</a>
        <a href="#holdings">持仓明细</a>
        <a href="#manager">管理人与规则</a>
        <a href="#tradeRules">费率规则</a>
      </aside>

      <section className="fund-workbench">
        <header className="fund-profile-bar">
          <div>
            <Link to="/" className="back-link">返回筛选</Link>
            <div className="fund-title-row">
              <h1>{fund.name}</h1>
              <span>({fund.code})</span>
              <span className="fund-tag danger">{riskLevel}</span>
              <span className="fund-tag">{fund.fund_type}</span>
              <span className="fund-tag">销售状态待同步</span>
              <span className="fund-tag">{fund.fund_type.includes("指数") ? "被动指数" : "主动权益"}</span>
            </div>
            <div className="fund-meta-line">
              <span>基金公司：{displayValue(profile?.fund_company ?? fund.manager)}</span>
              <span>现任基金经理：{displayValue(profile?.fund_manager ?? fund.fund_manager)}</span>
              <span>基金规模：{formatAssetSize(profile?.asset_size_billion ?? fund.asset_size_billion)}</span>
              <span>成立日期：{profile?.inception_date ?? fund.inception_date}</span>
              <span>数据更新日：{latestDataDate ?? "暂无"}</span>
            </div>
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
            <Link className="primary-button as-link" to={`/compare?codes=${fund.code}`}>
              加入对比
            </Link>
            {watchlistMessage ? <p className="muted-note">{watchlistMessage}</p> : null}
          </div>
        </header>

        <section className="cmb-section" id="basicInfo">
          <h2>基本信息</h2>
          <div className="cmb-metric-grid">
            <KpiTile label="日涨跌幅" value={formatMaybePercent(dailyReturn)} hot />
            <KpiTile label="近一年收益率" value={formatMaybePercent(metrics.period_returns["1y"])} hot />
            <KpiTile label="累计收益率" value={formatPercent(metrics.total_return)} hot />
            <KpiTile label="累计年化收益率" value={formatPercent(metrics.annualized_return)} hot />
            <KpiTile label="今年以来收益率" value={formatMaybePercent(metrics.period_returns.ytd)} hot />
            <KpiTile label="近一年最大回撤" value={formatMaybePercent(metrics.period_drawdowns["1y"])} />
            <KpiTile label="夏普比率" value={formatNumber(metrics.sharpe_ratio)} />
            <KpiTile label="历史最大回撤" value={formatPercent(metrics.max_drawdown)} />
            <KpiTile label="管理区间收益" value={formatPercent(metrics.total_return)} hot />
            <KpiTile label="换手率" value="暂无" />
          </div>
          <div className="fund-footnotes">
            <span>单位净值：{formatNumber(latestNav?.nav, 4)}</span>
            <span>累计净值：{formatNumber(latestNav?.accumulated_nav ?? latestNav?.nav, 4)}</span>
            <span>业绩基准：{displayValue(profile?.benchmark, "暂无真实基准数据")}</span>
          </div>
        </section>

        <section className="cmb-section" id="performance">
          <div className="section-title-row">
            <h2>业绩总览</h2>
          </div>
          <div className="performance-grid">
            <div className="chart-panel">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={returnSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5edf7" />
                  <XAxis dataKey="date" minTickGap={42} />
                  <YAxis tickFormatter={(value) => `${Number(value * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(value) => formatPercent(Number(value))} />
                  <Line type="monotone" dataKey="fund" name={fund.name} stroke="#2563eb" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <p className="muted-note">
                当前曲线基于后端返回的累计净值计算；业绩基准文字来自基金 profile，基准曲线和同类平均需要接入可复核的时序数据后展示。
              </p>
              <div className="range-shortcuts">
                <span>近1月</span>
                <span>近3月</span>
                <span>近6月</span>
                <span>近1年</span>
                <span>近3年</span>
                <strong>成立以来</strong>
              </div>
            </div>
            <div className="period-table" id="periodReturns">
              <div className="segmented-tabs compact">
                <button
                  className={performanceMode === "stage" ? "active" : ""}
                  onClick={() => setPerformanceMode("stage")}
                  type="button"
                >
                  阶段涨幅
                </button>
                <button disabled title="当前数据源暂无可复核季度业绩" type="button">
                  季度涨幅
                </button>
                <button
                  className={performanceMode === "year" ? "active" : ""}
                  onClick={() => setPerformanceMode("year")}
                  type="button"
                >
                  年度涨幅
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>区间</th>
                    <th>本基金</th>
                    <th>最大回撤</th>
                    <th>同类排名</th>
                  </tr>
                </thead>
                <tbody>
                  {periodRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className={row.value != null && row.value >= 0 ? "positive" : "negative"}>
                        {formatMaybePercent(row.value)}
                      </td>
                      <td>{formatMaybePercent(row.maxDrawdown)}</td>
                      <td>{row.rank ?? "暂无"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="chart-two-col">
          <article className="cmb-section" id="rollingReturn">
            <h2>滚动收益曲线</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rollingSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5edf7" />
                <XAxis dataKey="date" minTickGap={42} />
                <YAxis tickFormatter={(value) => `${Number(value * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value) => formatPercent(Number(value))} />
                <Line type="monotone" dataKey="return" name="半年滚动收益" stroke="#2563eb" dot={false} strokeWidth={1.8} />
              </LineChart>
            </ResponsiveContainer>
          </article>
          <article className="cmb-section" id="drawdown">
            <h2>回撤曲线</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={drawdownSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5edf7" />
                <XAxis dataKey="date" minTickGap={42} />
                <YAxis tickFormatter={(value) => `${Number(value * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value) => formatPercent(Number(value))} />
                <Area type="monotone" dataKey="drawdown" name="回撤" stroke="#2563eb" fill="#dbeafe" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </article>
        </section>

        <section className="chart-two-col">
          <article className="cmb-section" id="riskMetrics">
            <h2>收益指标</h2>
            <div className="info-grid">
              <span>Sortino <strong>{formatNumber(metrics.sortino_ratio)}</strong></span>
              <span>Calmar <strong>{formatNumber(metrics.calmar_ratio)}</strong></span>
              <span>下行波动 <strong>{formatPercent(metrics.downside_volatility)}</strong></span>
              <span>正收益日占比 <strong>{formatPercent(metrics.positive_day_rate)}</strong></span>
              <span>95% VaR <strong>{formatPercent(metrics.value_at_risk_95)}</strong></span>
              <span>条件 VaR <strong>{formatPercent(metrics.conditional_value_at_risk_95)}</strong></span>
              <span>最好单日 <strong>{formatPercent(metrics.best_daily_return)}</strong></span>
              <span>最差单日 <strong>{formatPercent(metrics.worst_daily_return)}</strong></span>
            </div>
          </article>
          <article className="cmb-section" id="holdingAnalysis">
            <h2>持有分析</h2>
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
            <div className="info-grid">
              <span>持有胜率 <strong>{formatPercent(metrics.holding_analysis.win_rate)}</strong></span>
              <span>平均收益 <strong>{formatPercent(metrics.holding_analysis.average_return)}</strong></span>
              <span>中位数收益 <strong>{formatPercent(metrics.holding_analysis.median_return)}</strong></span>
              <span>样本数 <strong>{metrics.holding_analysis.sample_count}</strong></span>
            </div>
          </article>
        </section>

        <section className="chart-two-col">
          <article className="cmb-section" id="holdings">
            <h2>持仓分析</h2>
            <div className="placeholder-grid">
              <span>持仓明细</span>
              <strong>暂无持仓穿透数据</strong>
              <span>板块分布 / 行业分布 / 重仓股分析</span>
              <p>当前数据源以历史净值为主，后续可接入季报持仓后补齐本模块。</p>
            </div>
          </article>
          <article className="cmb-section" id="manager">
            <h2>管理人与交易规则</h2>
            <div className="info-grid">
              <span>基金全称 <strong>{displayValue(profile?.full_name)}</strong></span>
              <span>基金管理人 <strong>{displayValue(profile?.fund_company ?? fund.manager)}</strong></span>
              <span>基金经理 <strong>{displayValue(profile?.fund_manager ?? fund.fund_manager)}</strong></span>
              <span>托管机构 <strong>{displayValue(profile?.custodian)}</strong></span>
              <span>投资目标 <strong>{displayValue(profile?.investment_target)}</strong></span>
              <span>投资策略 <strong>{displayValue(profile?.investment_strategy)}</strong></span>
              <span id="tradeRules">申购状态 <strong>待同步</strong></span>
              <span>赎回状态 <strong>待同步</strong></span>
            </div>
          </article>
        </section>

        <section className="cmb-section">
          <h2>历史净值</h2>
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
        </section>
      </section>
    </main>
  );
}

function KpiTile({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="cmb-kpi">
      <span>{label}</span>
      <strong className={hot ? "hot" : ""}>{value}</strong>
    </div>
  );
}

function buildReturnSeries(nav: NavPoint[]): ReturnPoint[] {
  const base = firstAccumulatedNav(nav);
  if (!base) return [];
  return nav.map((point) => {
    const fund = (point.accumulated_nav ?? point.nav) / base - 1;
    return {
      date: point.date,
      fund,
    };
  });
}

function buildRollingSeries(nav: NavPoint[], values: number[]): Array<{ date: string; return: number }> {
  if (!values.length) return [];
  const offset = Math.max(0, nav.length - values.length);
  return values.map((value, index) => ({
    date: nav[index + offset]?.date ?? String(index + 1),
    return: value,
  }));
}

function buildPeriodRows(
  metrics: FundMetrics | undefined,
  performance: FundPerformanceItem[],
  mode: PerformanceMode,
): PeriodRow[] {
  const sourcedRows = performance
    .filter((row) => row.performance_type === mode)
    .map((row) => ({
      label: row.period,
      value: row.return_rate ?? null,
      maxDrawdown: row.max_drawdown ?? null,
      rank: row.rank ?? null,
    }));
  if (sourcedRows.length) {
    return sourcedRows;
  }

  if (mode === "year") {
    return Object.entries(metrics?.yearly_returns ?? {})
      .sort(([left], [right]) => Number(right) - Number(left))
      .map(([year, value]) => ({
        label: year,
        value,
        maxDrawdown: null,
        rank: null,
      }));
  }

  return [
    { label: "近一周", value: metrics?.period_returns["1w"] ?? null, maxDrawdown: metrics?.period_drawdowns["1w"] ?? null, rank: null },
    { label: "近一月", value: metrics?.period_returns["1m"] ?? null, maxDrawdown: metrics?.period_drawdowns["1m"] ?? null, rank: null },
    { label: "近三月", value: metrics?.period_returns["3m"] ?? null, maxDrawdown: metrics?.period_drawdowns["3m"] ?? null, rank: null },
    { label: "近半年", value: metrics?.period_returns["6m"] ?? null, maxDrawdown: metrics?.period_drawdowns["6m"] ?? null, rank: null },
    { label: "近一年", value: metrics?.period_returns["1y"] ?? null, maxDrawdown: metrics?.period_drawdowns["1y"] ?? null, rank: null },
    { label: "近三年", value: metrics?.period_returns["3y"] ?? null, maxDrawdown: metrics?.period_drawdowns["3y"] ?? null, rank: null },
    { label: "近五年", value: metrics?.period_returns["5y"] ?? null, maxDrawdown: metrics?.period_drawdowns["5y"] ?? null, rank: null },
    { label: "成立以来", value: metrics?.period_returns.since_inception ?? null, maxDrawdown: metrics?.period_drawdowns.since_inception ?? null, rank: null },
  ];
}

function firstAccumulatedNav(nav: NavPoint[]): number | null {
  const first = nav[0];
  return first ? first.accumulated_nav ?? first.nav : null;
}

function formatMaybePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "暂无" : formatPercent(value);
}

function displayValue(value: string | null | undefined, fallback = "待同步"): string {
  return value?.trim() ? value : fallback;
}

function formatAssetSize(value: number | null | undefined): string {
  return value == null || value <= 0 ? "暂无" : `${formatNumber(value, 2)} 亿`;
}

function inferRiskLevel(fundType: string): string {
  if (fundType.includes("货币")) return "R1风险";
  if (fundType.includes("债")) return "R2风险";
  if (fundType.includes("股票") || fundType.includes("偏股")) return "R4风险";
  return "R3风险";
}
