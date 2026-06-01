import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AdvancedMetricsPanel } from "../components/AdvancedMetricsPanel";
import { MetricCard } from "../components/MetricCard";
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
  const query = useQuery({
    queryKey: ["portfolio-backtest", holdings],
    queryFn: () => backtestPortfolio(holdings),
  });
  const result = query.data;
  const totalWeight = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.weight, 0),
    [holdings],
  );

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
          <strong>{formatPercent(totalWeight)}</strong>
          <small>后端会自动归一化权重用于回测</small>
        </div>
      </section>

      <section className="analysis-panel wide">
        <div className="panel-heading">
          <div>
            <h2>资产配置</h2>
            <p>第一版先用代码输入，后续可接搜索选择器、调仓频率和再平衡规则。</p>
          </div>
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
            <AdvancedMetricsPanel metrics={result.metrics} />
            <article className="analysis-panel">
              <h2>收益贡献</h2>
              <div className="risk-stack">
                {result.contributions.map((item) => (
                  <span key={`${item.asset_type}-${item.code}`}>
                    {item.code} · {formatPercent(item.weight)}
                    <strong>{formatPercent(item.contribution)}</strong>
                  </span>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : (
        <section className="analysis-panel">组合回测计算中...</section>
      )}
    </main>
  );
}
