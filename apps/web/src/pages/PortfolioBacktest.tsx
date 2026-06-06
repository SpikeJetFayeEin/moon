import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ContributionBarChart, DrawdownAreaChart } from "../components/AnalyticsCharts";
import { NavChart } from "../components/NavChart";
import { QueryStatePanel } from "../components/QueryStatePanel";
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
  const totalWeight = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.weight, 0),
    [holdings],
  );
  const weightIsValid = Math.abs(totalWeight - 1) < 0.001;
  const query = useQuery({
    queryKey: ["portfolio-backtest", holdings, rebalanceFrequency, benchmark],
    queryFn: () =>
      backtestPortfolio(holdings, {
        rebalanceFrequency,
        benchmark,
      }),
    enabled: weightIsValid,
  });
  const result = query.data;
  const contributionRows = result?.contributions ?? [];
  const maxContribution = Math.max(
    0.01,
    ...contributionRows.map((item) => Math.abs(item.contribution)),
  );

  function updateHolding(index: number, patch: Partial<PortfolioHolding>) {
    setHoldings((current) =>
      current.map((holding, itemIndex) =>
        itemIndex === index ? { ...holding, ...patch } : holding,
      ),
    );
  }

  return (
    <main className="terminal-page wide-rail">
      <aside className="terminal-rail">
        <div className="terminal-title-row">
          <h2>组合构建</h2>
          <span className="badge">权重{formatPercent(totalWeight)}</span>
        </div>
        <div className="holding-editor">
          {holdings.map((holding, index) => (
            <div className="holding-editor-row terminal-control" key={`${holding.asset_type}-${holding.code}-${index}`}>
              <label>
                类型
                <select
                  onChange={(event) =>
                    updateHolding(index, { asset_type: event.target.value as "fund" | "index" })
                  }
                  value={holding.asset_type}
                >
                  <option value="fund">基金</option>
                  <option value="index">指数</option>
                </select>
              </label>
              <label>
                代码
                <input
                  onChange={(event) => updateHolding(index, { code: event.target.value.trim() })}
                  value={holding.code}
                />
              </label>
              <label>
                权重
                <input
                  min="0.01"
                  onChange={(event) => updateHolding(index, { weight: Number(event.target.value) })}
                  step="0.01"
                  type="number"
                  value={holding.weight}
                />
              </label>
            </div>
          ))}
        </div>
        <div className="terminal-filter-group">
          <div className="terminal-filter-title">回测参数</div>
          <label>
            再平衡
            <select onChange={(event) => setRebalanceFrequency(event.target.value)} value={rebalanceFrequency}>
              <option value="none">不再平衡</option>
              <option value="monthly">每月</option>
              <option value="quarterly">每季度</option>
              <option value="yearly">每年</option>
            </select>
          </label>
          <label>
            基准类型
            <select
              onChange={(event) =>
                setBenchmark((current) => ({
                  ...current,
                  asset_type: event.target.value as "fund" | "index",
                }))
              }
              value={benchmark.asset_type}
            >
              <option value="index">指数</option>
              <option value="fund">基金</option>
            </select>
          </label>
          <label>
            基准代码
            <input
              onChange={(event) =>
                setBenchmark((current) => ({ ...current, code: event.target.value.trim() }))
              }
              value={benchmark.code}
            />
          </label>
        </div>
        <div className="terminal-filter-group">
          <div className="terminal-filter-title">约束条件</div>
          <label className="terminal-check"><input defaultChecked type="checkbox" />按共同交易日对齐</label>
          <label className="terminal-check"><input defaultChecked type="checkbox" />现金留存 0%</label>
          <label className="terminal-check"><input disabled type="checkbox" />交易成本（待接入）</label>
        </div>
        <button
          className="primary-button"
          disabled={!weightIsValid || query.isFetching}
          onClick={() => void query.refetch()}
          type="button"
        >
          {query.isFetching ? "回测更新中" : "刷新回测"}
        </button>
        <button className="ghost-button" disabled type="button">保存模板（待接入）</button>
      </aside>

      <section className="terminal-main">
        <section className="terminal-card terminal-hero">
          <div>
            <p className="hint">Portfolio Backtest</p>
            <h1>月度再平衡组合回测</h1>
            <p>基金与全收益指数混合配置；净值按共同日期对齐，输出收益、回撤、贡献和压力情景。</p>
            <div className="terminal-pill-row">
              <span className="terminal-pill">{holdings.length} 个资产</span>
              <span className="terminal-pill">{rebalanceLabel(rebalanceFrequency)}再平衡</span>
              <span className="terminal-pill">基准 {benchmark.code.toUpperCase()}</span>
              <span className="terminal-pill">{weightIsValid ? "权重有效" : "需调整权重"}</span>
            </div>
          </div>
          <div className="terminal-score">
            <span>权重合计</span>
            <strong className={weightIsValid ? "up" : "down"}>{formatPercent(totalWeight)}</strong>
            <small className="hint">{weightIsValid ? "可执行当前回测" : "建议调整至 100%"}</small>
          </div>
        </section>

        {!weightIsValid ? (
          <QueryStatePanel
            title="权重合计需要等于 100%"
            description={`当前权重为 ${formatPercent(totalWeight)}，请调整资产权重后再运行回测。`}
            tone="error"
          />
        ) : query.isFetching && !result ? (
          <QueryStatePanel title="正在计算组合回测" description="正在按共同净值日期对齐资产并计算收益、回撤和贡献。" tone="loading" />
        ) : query.isError ? (
          <QueryStatePanel title="组合回测加载失败" description="请检查资产代码、权重和基准设置，或稍后重试。" tone="error" />
        ) : result ? (
          <>
            <section className="overview">
              <article className="terminal-card">
                <div className="terminal-kpi-grid">
                  <div className="terminal-kpi"><span>累计收益</span><strong className="up">{formatPercent(result.metrics.total_return)}</strong></div>
                  <div className="terminal-kpi"><span>年化收益</span><strong className="up">{formatPercent(result.metrics.annualized_return)}</strong></div>
                  <div className="terminal-kpi"><span>最大回撤</span><strong className="down">{formatPercent(result.metrics.max_drawdown)}</strong></div>
                  <div className="terminal-kpi"><span>夏普比率</span><strong>{formatNumber(result.metrics.sharpe_ratio)}</strong></div>
                  <div className="terminal-kpi"><span>超额收益</span><strong className="up">{formatPercent(result.benchmark?.excess_return ?? 0)}</strong></div>
                </div>
              </article>
              <article className="terminal-card">
                <div className="terminal-title-row">
                  <h2>贡献结构</h2>
                  <span className="hint">来自本次回测</span>
                </div>
                <div className="mini-bars compact">
                  {contributionRows.map((item, index) => (
                    <div
                      className="mini-bar"
                      key={`${item.asset_type}-${item.code}`}
                      style={{
                        background: item.contribution >= 0 ? "#ef4444" : "#047857",
                        height: Math.max(36, Math.abs(item.contribution) / maxContribution * 120),
                      }}
                    >
                      <small>{item.code}</small>
                    </div>
                  ))}
                </div>
                <p>贡献 = 目标权重 × 区间收益；负值代表拖累组合收益。</p>
              </article>
            </section>

            <section className="terminal-chart-grid two-one">
              <article className="terminal-card terminal-chart" style={{ gridColumn: "span 1" }}>
                <div className="terminal-title-row">
                  <h2>组合净值与基准</h2>
                  <span className="hint">归一化累计收益</span>
                </div>
                <NavChart data={result.nav} height={290} />
              </article>
              <article className="terminal-card terminal-chart">
                <div className="terminal-title-row">
                  <h2>收益贡献</h2>
                  <span className="hint">权重×收益</span>
                </div>
                <ContributionBarChart height={260} items={result.contributions} />
              </article>
              <article className="terminal-card terminal-chart">
                <div className="terminal-title-row">
                  <h2>回撤曲线</h2>
                  <span className="hint">压力阶段</span>
                </div>
                <DrawdownAreaChart data={result.drawdowns} height={260} />
              </article>
            </section>

            <section className="terminal-table">
              <div className="terminal-table-header">
                <h2>再平衡记录</h2>
                <span className="hint">最近 {result.rebalance_dates.length || 0} 次</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>触发原因</th>
                    {holdings.map((holding) => <th key={holding.code}>{holding.code}</th>)}
                    <th>目标权重</th>
                    <th>组合净值</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.rebalance_dates.length ? result.rebalance_dates : result.nav.slice(-3).map((point) => point.date)).slice(-3).map((date) => (
                    <tr key={date}>
                      <td>{date}</td>
                      <td>{result.rebalance_dates.length ? `${rebalanceLabel(rebalanceFrequency)}再平衡` : "样本日期"}</td>
                      {holdings.map((holding) => (
                        <td key={holding.code}>
                          {formatPercent(holding.weight)}
                        </td>
                      ))}
                      <td>{holdings.map((holding) => Math.round(holding.weight * 100)).join(" / ")}</td>
                      <td>{formatNumber(result.nav[result.nav.length - 1]?.nav, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : (
          <QueryStatePanel title="暂无组合回测结果" description="调整资产和基准后点击刷新回测。" />
        )}
      </section>

      <aside className="terminal-right">
        <div className="terminal-title-row">
          <h2>回测诊断</h2>
          <span className="hint">ⓘ</span>
        </div>
        <h3>风险指标</h3>
        <div className="terminal-insight-list">
          <div className="terminal-insight-row"><span>累计收益</span><b>组合</b><strong className="up">{formatPercent(result?.metrics.total_return ?? 0)}</strong></div>
          <div className="terminal-insight-row"><span>最大回撤</span><b>组合</b><strong className="down">{formatPercent(result?.metrics.max_drawdown ?? 0)}</strong></div>
          <div className="terminal-insight-row"><span>年化波动</span><b>组合</b><strong>{formatPercent(result?.metrics.volatility ?? 0)}</strong></div>
          <div className="terminal-insight-row"><span>再平衡次数</span><b>{rebalanceLabel(rebalanceFrequency)}</b><strong>{result?.rebalance_dates.length ?? 0}</strong></div>
        </div>
        <h3>基准对比</h3>
        <div className="terminal-insight-list">
          <div className="terminal-insight-row"><span>超额收益</span><b>{benchmark.code}</b><strong className="up">{formatPercent(result?.benchmark?.excess_return ?? 0)}</strong></div>
          <div className="terminal-insight-row"><span>跟踪误差</span><b>TE</b><strong>{formatPercent(result?.benchmark?.tracking_error ?? 0)}</strong></div>
          <div className="terminal-insight-row"><span>信息比率</span><b>IR</b><strong>{formatNumber(result?.benchmark?.information_ratio)}</strong></div>
        </div>
        <div className="terminal-note-box">
          组合回测使用共同净值日期对齐，结果受样本区间、再平衡频率和基准选择影响；本页不提供仓位建议。
        </div>
        <div className="terminal-pill-row">
          <span className="terminal-pill">共同日期对齐</span>
          <span className="terminal-pill">贡献可复核</span>
          <span className="terminal-pill">无主观评级</span>
        </div>
      </aside>
    </main>
  );
}

function rebalanceLabel(value: string): string {
  if (value === "monthly") return "每月";
  if (value === "quarterly") return "每季度";
  if (value === "yearly") return "每年";
  return "不";
}
