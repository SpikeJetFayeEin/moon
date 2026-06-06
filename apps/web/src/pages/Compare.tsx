import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  DrawdownAreaChart,
  NormalizedReturnChart,
  RiskReturnScatterChart,
  buildDrawdownRows,
} from "../components/AnalyticsCharts";
import { useSession } from "../hooks/useSession";
import { compareFunds, listCompareLists, saveCompareList } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import type { CompareItem, NavPoint } from "../types";

export function Compare() {
  const { accessToken } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCodes = searchParams.get("codes") ?? "000300,110022";
  const [codesInput, setCodesInput] = useState(initialCodes);
  const codes = useMemo(
    () =>
      codesInput
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    [codesInput],
  );
  const compareQuery = useQuery({
    queryKey: ["compare", codes.join(",")],
    queryFn: () => compareFunds(codes),
    enabled: codes.length >= 2,
  });
  const compareListsQuery = useQuery({
    queryKey: ["compare-lists", accessToken],
    queryFn: () => listCompareLists(accessToken),
    enabled: Boolean(accessToken),
  });
  const items = compareQuery.data ?? [];
  const firstItem = items[0];
  const bestReturnItem = findBest(items, (item) => item.total_return);
  const lowerDrawdownItem = findBest(items, (item) => item.max_drawdown);
  const bestSharpeItem = findBest(items, (item) => item.sharpe_ratio);
  const correlation = useMemo(() => buildCorrelationCells(items), [items]);

  useEffect(() => {
    setCodesInput(searchParams.get("codes") ?? "000300,110022");
  }, [searchParams]);

  function updateCodesInput(nextValue: string) {
    setCodesInput(nextValue);
    const normalizedCodes = normalizeCodes(nextValue);
    setSearchParams(normalizedCodes ? { codes: normalizedCodes } : {});
  }

  return (
    <main className="terminal-page compare-page">
      <section className="terminal-main">
        <section className="overview">
          <article className="terminal-card terminal-hero">
            <div>
              <p className="hint">Fund Compare</p>
              <h1>多基金收益、回撤与风格对比</h1>
              <p>同口径归一化净值，对比收益路径、风险代价、相关性和经理风格。</p>
              <div className="terminal-pill-row">
                {codes.map((code, index) => (
                  <span className="fund-chip" key={code} style={{ background: chipColor(index) }}>
                    {items[index]?.name ?? code}
                  </span>
                ))}
              </div>
            </div>
          </article>
          <article className="terminal-card">
            <span className="hint">样本概览</span>
            <h1 className="up" style={{ margin: "10px 0", fontSize: 34 }}>
              {items.length ? `${items.length} 只基金` : "等待对比数据"}
            </h1>
            <p>收益、回撤、波动率与夏普放在同一屏，便于逐项核对风险收益证据。</p>
          </article>
        </section>

        <section className="terminal-card">
          <div className="terminal-title-row">
            <h2>对比输入</h2>
            <button
              className="ghost-button"
              disabled={codes.length < 2}
              onClick={async () => {
                await saveCompareList(`对比 ${codes.join("/")}`, codes, accessToken);
                await compareListsQuery.refetch();
              }}
              type="button"
            >
              保存对比
            </button>
          </div>
          <div className="toolbar" style={{ marginTop: 12, padding: 0, border: 0, boxShadow: "none" }}>
            <input onChange={(event) => updateCodesInput(event.target.value)} value={codesInput} />
            <span className="result-count">{items.length || codes.length} 只基金</span>
          </div>
          {accessToken ? (
            <div className="saved-strip" style={{ marginTop: 12 }}>
              <span>已保存对比</span>
              {(compareListsQuery.data ?? []).map((item) => (
                <button key={item.id} onClick={() => updateCodesInput(item.codes.join(","))} type="button">
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {items.length ? (
          <>
            <section className="terminal-chart-grid two">
              <article className="terminal-card terminal-chart">
                <div className="terminal-title-row">
                  <h2>归一化累计收益</h2>
                  <span className="hint">同起点对比</span>
                </div>
                <NormalizedReturnChart
                  height={300}
                  series={items.map((item, index) => ({
                    color: chipColor(index),
                    name: item.name,
                    nav: item.nav,
                  }))}
                />
              </article>
              <article className="terminal-card terminal-chart">
                <div className="terminal-title-row">
                  <h2>风险收益散点</h2>
                  <span className="hint">点大小=回撤</span>
                </div>
                <RiskReturnScatterChart height={300} items={items} />
              </article>
            </section>
            <section className="terminal-chart-grid two">
              <article className="terminal-card terminal-chart">
                <div className="terminal-title-row">
                  <h2>最大回撤对比</h2>
                  <span className="hint">样本基金</span>
                </div>
                <DrawdownAreaChart data={firstItem ? buildDrawdownRows(firstItem.nav) : []} height={230} />
              </article>
              <article className="terminal-card terminal-chart">
                <div className="terminal-title-row">
                  <h2>相关性矩阵</h2>
                  <span className="hint">按可对齐净值日期估算</span>
                </div>
                <div
                  className="correlation-grid"
                  style={{ gridTemplateColumns: `repeat(${correlation.size}, minmax(0, 1fr))` }}
                >
                  {correlation.cells.map((cell) => (
                    <div
                      className={
                        cell.value == null ? "corr empty" : cell.value > 0.8 ? "corr hot" : cell.value > 0.55 ? "corr mid" : "corr"
                      }
                      key={cell.key}
                      title={cell.label}
                    >
                      {cell.value == null ? "暂无" : cell.value.toFixed(2)}
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}

        <section className="terminal-table">
          <div className="terminal-table-header">
            <h2>核心指标对照</h2>
            <span className="hint">收益、风险和风格标签</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>代码</th>
                <th>基金名称</th>
                <th>累计收益</th>
                <th>最大回撤</th>
                <th>波动率</th>
                <th>夏普</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.code}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td className="up">{formatPercent(item.total_return)}</td>
                  <td className="down">{formatPercent(item.max_drawdown)}</td>
                  <td>{formatPercent(item.volatility)}</td>
                  <td>{formatNumber(item.sharpe_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      <aside className="terminal-right">
        <div className="terminal-title-row">
          <h2>对比洞察</h2>
          <span className="hint">ⓘ</span>
        </div>
        <h3>指标摘要</h3>
        <div className="terminal-insight-list">
          <div className="terminal-insight-row"><span>收益最高</span><b>{bestReturnItem?.name ?? "暂无"}</b><strong className="up">{bestReturnItem ? formatPercent(bestReturnItem.total_return) : "暂无"}</strong></div>
          <div className="terminal-insight-row"><span>回撤较小</span><b>{lowerDrawdownItem?.name ?? "暂无"}</b><strong className="down">{lowerDrawdownItem ? formatPercent(lowerDrawdownItem.max_drawdown) : "暂无"}</strong></div>
          <div className="terminal-insight-row"><span>夏普较高</span><b>{bestSharpeItem?.name ?? "暂无"}</b><strong>{bestSharpeItem ? formatNumber(bestSharpeItem.sharpe_ratio) : "暂无"}</strong></div>
          <div className="terminal-insight-row"><span>基金数量</span><b>当前</b><strong>{items.length} 只</strong></div>
        </div>
        <h3>读数说明</h3>
        <div className="terminal-note-box">
          本页仅做同口径指标排序和图表对比，不把任何基金标记为主观评级或操作信号。
        </div>
        <div className="terminal-pill-row">
          <span className="terminal-pill">同口径净值</span>
          <span className="terminal-pill">可保存列表</span>
          <span className="terminal-pill">无主观评级</span>
        </div>
        <p className="terminal-note">口径：前复权单位净值；收益率已扣管理费，不含申购赎回成本。</p>
      </aside>
    </main>
  );
}

function chipColor(index: number): string {
  return ["#0b72f0", "#ff8a1c", "#13a7b3", "#7c3aed", "#64748b", "#dc2626"][index % 6];
}

function normalizeCodes(value: string): string {
  return value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
    .join(",");
}

function findBest(items: CompareItem[], read: (item: CompareItem) => number) {
  return items.reduce<CompareItem | null>((best, item) => {
    if (!best) return item;
    return read(item) > read(best) ? item : best;
  }, null);
}

function buildCorrelationCells(items: CompareItem[]) {
  const visibleItems = items.slice(0, 4);
  const size = Math.max(2, visibleItems.length || 2);
  const returnMaps = visibleItems.map((item) => ({
    item,
    returns: buildReturnMap(item.nav),
  }));

  return {
    size,
    cells: Array.from({ length: size * size }, (_, index) => {
      const row = Math.floor(index / size);
      const column = index % size;
      const left = returnMaps[row];
      const right = returnMaps[column];
      const value = left && right ? calculateCorrelation(left.returns, right.returns) : null;
      return {
        key: `${row}-${column}`,
        label: `${left?.item.name ?? "暂无"} / ${right?.item.name ?? "暂无"}`,
        value,
      };
    }),
  };
}

function buildReturnMap(nav: NavPoint[]) {
  const rows = [...nav].sort((left, right) => left.date.localeCompare(right.date));
  const returns = new Map<string, number>();
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1]?.accumulated_nav ?? rows[index - 1]?.nav;
    const current = rows[index]?.accumulated_nav ?? rows[index]?.nav;
    if (previous && current) {
      returns.set(rows[index].date, current / previous - 1);
    }
  }
  return returns;
}

function calculateCorrelation(left: Map<string, number>, right: Map<string, number>) {
  const pairs = Array.from(left.entries())
    .filter(([date]) => right.has(date))
    .map(([date, leftValue]) => [leftValue, right.get(date) ?? 0]);
  if (pairs.length < 3) return null;
  const leftMean = pairs.reduce((sum, [value]) => sum + value, 0) / pairs.length;
  const rightMean = pairs.reduce((sum, [, value]) => sum + value, 0) / pairs.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (const [leftValue, rightValue] of pairs) {
    const leftDelta = leftValue - leftMean;
    const rightDelta = rightValue - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? numerator / denominator : null;
}
