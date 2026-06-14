import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { MetricStrip } from "../components/MetricStrip";
import { NormalizedReturnChart, ProductRiskReturnScatter } from "../components/AnalyticsCharts";
import { QueryStatePanel } from "../components/QueryStatePanel";
import { getFundManager, getFundManagerProductComparison } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { FundManagerComparisonPeriod, FundManagerProductComparisonItem } from "../types";

const periods: Array<{ label: string; value: FundManagerComparisonPeriod }> = [
  { label: "近1月", value: "1m" },
  { label: "近3月", value: "3m" },
  { label: "近6月", value: "6m" },
  { label: "近1年", value: "1y" },
  { label: "近3年", value: "3y" },
];

export function FundManagerAnalysis() {
  const { managerId = "" } = useParams();
  const [period, setPeriod] = useState<FundManagerComparisonPeriod>("1y");
  const managerQuery = useQuery({
    queryKey: ["fund-manager", managerId],
    queryFn: () => getFundManager(managerId),
  });
  const comparisonQuery = useQuery({
    queryKey: ["fund-manager-comparison", managerId, period],
    queryFn: () => getFundManagerProductComparison(managerId, period),
  });
  const items = comparisonQuery.data?.items ?? [];
  const readyItems = items.filter((item) => item.status === "ready");
  const pendingItems = items.filter((item) => item.status === "pending_data");
  const trendSeries = useMemo(
    () => readyItems.map((item) => ({ name: item.name, nav: item.nav })),
    [readyItems],
  );

  if (managerQuery.isLoading || comparisonQuery.isLoading) {
    return (
      <main className="manager-analysis">
        <QueryStatePanel title="正在加载基金经理分析" description="正在读取在管产品关系和净值指标。" tone="loading" />
      </main>
    );
  }

  if (!managerQuery.data || managerQuery.isError || comparisonQuery.isError) {
    return (
      <main className="manager-analysis">
        <QueryStatePanel title="基金经理分析加载失败" description="请先同步基金经理数据，或返回搜索页重新选择。" tone="error" />
      </main>
    );
  }

  const averageReturn = average(readyItems.map((item) => item.return_rate));
  const worstDrawdown = Math.min(...readyItems.map((item) => item.max_drawdown ?? 0), 0);

  return (
    <main className="manager-analysis">
      <section className="manager-identity">
        <div>
          <Link className="back-link" to="/managers">返回基金经理搜索</Link>
          <p className="eyebrow">Managed Products</p>
          <h1>{managerQuery.data.name}</h1>
          <p>
            <span>{managerQuery.data.company}</span>
            <span>数据更新 {managerQuery.data.synced_at}</span>
          </p>
        </div>
        <div className="period-segments" aria-label="选择对比周期">
          {periods.map((item) => (
            <button
              className={period === item.value ? "active" : ""}
              key={item.value}
              onClick={() => setPeriod(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <MetricStrip
        items={[
          { label: "在管产品", value: String(items.length), detail: `${readyItems.length} 只可分析` },
          { label: "平均收益", value: formatMaybePercent(averageReturn), tone: averageReturn != null && averageReturn >= 0 ? "good" : "bad" },
          { label: "最大回撤", value: formatPercent(worstDrawdown), tone: "bad" },
          { label: "待同步数据", value: String(pendingItems.length), detail: "缺少 NAV", tone: pendingItems.length ? "accent" : "good" },
        ]}
      />

      <section className="manager-analysis-grid">
        <article className="analysis-panel">
          <div className="panel-heading">
            <div>
              <h2>在管产品对比</h2>
              <p>横轴为年化波动，纵轴为区间收益，气泡大小代表最新规模。</p>
            </div>
          </div>
          <ProductRiskReturnScatter items={readyItems} height={320} />
        </article>

        <article className="analysis-panel">
          <div className="panel-heading">
            <div>
              <h2>净值趋势</h2>
              <p>所选周期内的归一化收益走势。</p>
            </div>
          </div>
          <NormalizedReturnChart series={trendSeries} height={320} />
        </article>

        <article className="analysis-panel wide">
          <h2>产品指标</h2>
          <div className="product-comparison-list">
            {items.map((item) => (
              <ProductMetricRow item={item} key={item.code} />
            ))}
          </div>
        </article>
      </section>

      {pendingItems.length ? (
        <section className="pending-products">
          <h2>待同步数据</h2>
          <div>
            {pendingItems.map((item) => (
              <span key={item.code}>{item.code} {item.name}</span>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ProductMetricRow({ item }: { item: FundManagerProductComparisonItem }) {
  return (
    <div className={item.status === "ready" ? "product-metric-row" : "product-metric-row pending"}>
      <div>
        <strong>{item.name}</strong>
        <span>{item.code} · {item.fund_type ?? "类型待同步"}</span>
      </div>
      <span>{formatMaybePercent(item.return_rate)}</span>
      <span>{formatMaybePercent(item.volatility)}</span>
      <span>{formatMaybePercent(item.max_drawdown)}</span>
      <span>{formatNumber(item.asset_size_billion, 2)} 亿</span>
      <small>{item.status === "ready" ? item.latest_nav_date ?? "暂无日期" : "待同步数据"}</small>
    </div>
  );
}

function average(values: Array<number | null | undefined>): number | null {
  const cleanValues = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (!cleanValues.length) return null;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function formatMaybePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "暂无" : formatPercent(value);
}
