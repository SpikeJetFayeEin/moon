import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdvancedMetricsPanel } from "../components/AdvancedMetricsPanel";
import { ContributionBarChart } from "../components/AnalyticsCharts";
import { InsightPanel } from "../components/InsightPanel";
import { MetricCard } from "../components/MetricCard";
import { MetricStrip } from "../components/MetricStrip";
import { NavChart } from "../components/NavChart";
import { backtestPortfolio } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { PortfolioHolding } from "../types";

const defaultHoldings: PortfolioHolding[] = [
  { asset_type: "fund", code: "000300", weight: 0.4 },
  { asset_type: "fund", code: "110022", weight: 0.3 },
  { asset_type: "index", code: "ndx", weight: 0.3 },
];

export function PortfolioBacktest() {
  const [holdings, setHoldings] = useState(defaultHoldings);
  const [rebalanceFrequency, setRebalanceFrequency] = useState("monthly");
  const [benchmark, setBenchmark] = useState<PortfolioHolding>({
    asset_type: "index",
    code: "spx",
    weight: 1,
  });
  const query = useQuery({
    queryKey: ["portfolio-backtest", holdings, rebalanceFrequency, benchmark],
    queryFn: () =>
      backtestPortfolio(holdings, {
        rebalanceFrequency,
        benchmark,
      }),
  });
  const result = query.data;
  const totalWeight = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.weight, 0),
    [holdings],
  );
  const weightIsValid = Math.abs(totalWeight - 1) < 0.001;

  function updateHolding(index: number, patch: Partial<PortfolioHolding>) {
    setHoldings((current) =>
      current.map((holding, itemIndex) =>
        itemIndex === index ? { ...holding, ...patch } : holding,
      ),
    );
  }

  return (
    <main className="page-grid">
      <section className="detail-header">
        <div>
          <p className="eyebrow">Portfolio Backtest</p>
          <h1>组合回测</h1>
          <p>支持基金和全收益指数混合配置，按共同净值日期对齐后计算组合曲线和风险指标。</p>
        </div>
        <div className="index-source-card">
          <span>权重合计</span>
          <strong className={weightIsValid ? "positive" : "negative"}>{formatPercent(totalWeight)}</strong>
          <small>
            {weightIsValid ? "权重有效" : "建议调整至 100%"} ·{" "}
            {rebalanceFrequency === "none" ? "买入并持有" : `按${rebalanceLabel(rebalanceFrequency)}再平衡`}
          </small>
        </div>
      </section>

      <section className="analysis-panel wide">
        <div className="panel-heading">
          <div>
            <h2>资产配置</h2>
            <p>输入资产代码和目标权重，支持定期再平衡，并可设置基准做超额收益分析。</p>
          </div>
        </div>
        <div className="backtest-controls">
          <label>
            再平衡频率
            <select
              value={rebalanceFrequency}
              onChange={(event) => setRebalanceFrequency(event.target.value)}
            >
              <option value="none">不再平衡</option>
              <option value="monthly">每月</option>
              <option value="quarterly">每季度</option>
              <option value="yearly">每年</option>
            </select>
          </label>
          <label>
            基准类型
            <select
              value={benchmark.asset_type}
              onChange={(event) =>
                setBenchmark((current) => ({
                  ...current,
                  asset_type: event.target.value as "fund" | "index",
                }))
              }
            >
              <option value="index">指数</option>
              <option value="fund">基金</option>
            </select>
          </label>
          <label>
            基准代码
            <input
              value={benchmark.code}
              onChange={(event) =>
                setBenchmark((current) => ({ ...current, code: event.target.value.trim() }))
              }
            />
          </label>
        </div>
        <div className="holding-editor">
          {holdings.map((holding, index) => (
            <div className="holding-editor-row" key={`${holding.asset_type}-${holding.code}-${index}`}>
              <label>
                类型
                <select
                  value={holding.asset_type}
                  onChange={(event) =>
                    updateHolding(index, { asset_type: event.target.value as "fund" | "index" })
                  }
                >
                  <option value="fund">基金</option>
                  <option value="index">指数</option>
                </select>
              </label>
              <label>
                代码
                <input
                  value={holding.code}
                  onChange={(event) => updateHolding(index, { code: event.target.value.trim() })}
                />
              </label>
              <label>
                权重
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={holding.weight}
                  onChange={(event) => updateHolding(index, { weight: Number(event.target.value) })}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {result ? (
        <>
          <MetricStrip
            items={[
              { label: "累计收益", value: formatPercent(result.metrics.total_return), tone: "good" },
              { label: "最大回撤", value: formatPercent(result.metrics.max_drawdown), tone: "bad" },
              { label: "年化波动", value: formatPercent(result.metrics.volatility) },
              { label: "夏普比率", value: formatNumber(result.metrics.sharpe_ratio), tone: "accent" },
              { label: "再平衡次数", value: String(result.rebalance_dates.length), detail: rebalanceLabel(rebalanceFrequency) },
            ]}
          />
          <section className="metric-grid">
            <MetricCard label="累计收益" value={formatPercent(result.metrics.total_return)} tone="good" />
            <MetricCard label="年化收益" value={formatPercent(result.metrics.annualized_return)} tone="good" />
            <MetricCard label="最大回撤" value={formatPercent(result.metrics.max_drawdown)} tone="bad" />
            <MetricCard label="年化波动" value={formatPercent(result.metrics.volatility)} />
            <MetricCard label="夏普比率" value={formatNumber(result.metrics.sharpe_ratio)} />
          </section>
          <section className="analysis-layout">
            <article className="analysis-panel wide">
              <h2>组合净值曲线</h2>
              <NavChart data={result.nav} />
            </article>
            <article className="analysis-panel">
              <h2>收益贡献</h2>
              <p>按权重与资产收益拆解组合收益来源。</p>
              <ContributionBarChart items={result.contributions} />
            </article>
            <article className="analysis-panel">
              <h2>基准对比</h2>
              {result.benchmark ? (
                <div className="risk-stack">
                  <span>基准 <strong>{result.benchmark.code}</strong></span>
                  <span>超额收益 <strong>{formatPercent(result.benchmark.excess_return)}</strong></span>
                  <span>跟踪误差 <strong>{formatPercent(result.benchmark.tracking_error)}</strong></span>
                  <span>信息比率 <strong>{formatNumber(result.benchmark.information_ratio)}</strong></span>
                </div>
              ) : (
                <p>未设置基准。</p>
              )}
            </article>
            <AdvancedMetricsPanel metrics={result.metrics} />
            <InsightPanel
              title="配置贡献明细"
              description="贡献 = 权重 × 区间收益。"
              items={result.contributions.map((item) => ({
                label: `${item.asset_type === "index" ? "指数" : "基金"} ${item.code}`,
                value: formatPercent(item.contribution),
                detail: `权重 ${formatPercent(item.weight)} / 收益 ${formatPercent(item.total_return)}`,
                tone: item.contribution >= 0 ? "good" : "bad",
              }))}
              footnote="组合回测使用共同净值日期对齐，结果受样本区间影响。"
            />
            <article className="analysis-panel wide">
              <div className="panel-heading">
                <div>
                  <h2>回撤曲线</h2>
                  <p>展示组合净值从历史高点下跌的幅度，帮助定位风险暴露阶段。</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={result.drawdowns} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf2" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
                  <Tooltip formatter={(value) => formatPercent(Number(value))} />
                  <Area type="monotone" dataKey="drawdown" stroke="#b91c1c" fill="#fee2e2" />
                </AreaChart>
              </ResponsiveContainer>
            </article>
            <article className="analysis-panel wide">
              <h2>再平衡记录</h2>
              <p>
                {result.rebalance_dates.length > 0
                  ? result.rebalance_dates.join("、")
                  : "当前参数下未触发再平衡。"}
              </p>
            </article>
          </section>
        </>
      ) : (
        <section className="analysis-panel">组合回测计算中...</section>
      )}
    </main>
  );
}

function rebalanceLabel(value: string): string {
  if (value === "monthly") return "每月";
  if (value === "quarterly") return "每季度";
  if (value === "yearly") return "每年";
  return "不";
}
