import type { FundMetrics } from "../types";
import { formatNumber, formatPercent } from "../lib/format";

type AdvancedMetricsPanelProps = {
  metrics: FundMetrics;
};

export function AdvancedMetricsPanel({ metrics }: AdvancedMetricsPanelProps) {
  const yearlyReturnEntries = Object.entries(metrics.yearly_returns);
  const latestYear = yearlyReturnEntries[yearlyReturnEntries.length - 1];

  return (
    <article className="analysis-panel">
      <h2>高级风险收益</h2>
      <p>补充下行风险、尾部风险、日度胜率和年度表现，辅助观察收益质量。</p>
      <div className="risk-stack">
        <span>Sortino <strong>{formatNumber(metrics.sortino_ratio)}</strong></span>
        <span>Calmar <strong>{formatNumber(metrics.calmar_ratio)}</strong></span>
        <span>下行波动 <strong>{formatPercent(metrics.downside_volatility)}</strong></span>
        <span>正收益日占比 <strong>{formatPercent(metrics.positive_day_rate)}</strong></span>
        <span>
          95% VaR / CVaR{" "}
          <strong>
            {formatPercent(metrics.value_at_risk_95)} /{" "}
            {formatPercent(metrics.conditional_value_at_risk_95)}
          </strong>
        </span>
        <span>
          最佳 / 最差单日{" "}
          <strong>
            {formatPercent(metrics.best_daily_return)} / {formatPercent(metrics.worst_daily_return)}
          </strong>
        </span>
        {latestYear ? (
          <span>
            {latestYear[0]} 年收益 <strong>{formatPercent(latestYear[1])}</strong>
          </span>
        ) : null}
      </div>
    </article>
  );
}
