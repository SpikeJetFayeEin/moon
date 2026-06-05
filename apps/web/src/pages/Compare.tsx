import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  DrawdownAreaChart,
  NormalizedReturnChart,
  RiskReturnScatterChart,
  buildDrawdownRows,
} from "../components/AnalyticsCharts";
import { InsightPanel } from "../components/InsightPanel";
import { useSession } from "../hooks/useSession";
import { compareFunds, listCompareLists, saveCompareList } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";

export function Compare() {
  const { accessToken } = useSession();
  const [searchParams] = useSearchParams();
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

  return (
    <main className="page-grid">
      <section className="detail-header">
        <div>
          <p className="eyebrow">Compare</p>
          <h1>多基金收益、回撤与风险对比</h1>
          <p>输入 2 到 8 个基金代码，用逗号分隔。登录后可保存常用对比列表。</p>
        </div>
      </section>

      <section className="toolbar">
        <input value={codesInput} onChange={(event) => setCodesInput(event.target.value)} />
        <button
          className="ghost-button"
          disabled={codes.length < 2}
          onClick={async () => {
            await saveCompareList(`对比 ${codes.join("/")}`, codes, accessToken);
            await compareListsQuery.refetch();
          }}
        >
          保存对比
        </button>
      </section>

      {accessToken ? (
        <section className="saved-strip">
          <span>已保存对比</span>
          {(compareListsQuery.data ?? []).map((item) => (
            <button key={item.id} onClick={() => setCodesInput(item.codes.join(","))}>
              {item.name}
            </button>
          ))}
        </section>
      ) : null}

      {items.length ? (
        <section className="analysis-layout">
          <article className="analysis-panel wide">
            <div className="panel-heading">
              <div>
                <h2>归一化累计收益</h2>
                <p>所有基金从同一起点换算为累计收益，更容易比较路径差异。</p>
              </div>
            </div>
            <NormalizedReturnChart
              series={items.map((item) => ({ name: item.name, nav: item.nav }))}
              height={320}
            />
          </article>
          <article className="analysis-panel">
            <h2>风险收益散点</h2>
            <p>横轴波动率，纵轴累计收益，点大小参考最大回撤。</p>
            <RiskReturnScatterChart items={items} height={260} />
          </article>
          <article className="analysis-panel">
            <h2>样本回撤</h2>
            <p>{firstItem ? `${firstItem.name} 的回撤路径；完整多基金回撤可在后续扩展。` : "暂无样本。"}</p>
            <DrawdownAreaChart data={firstItem ? buildDrawdownRows(firstItem.nav) : []} height={260} />
          </article>
        </section>
      ) : null}

      <section className="table-shell">
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
            {(compareQuery.data ?? []).map((item) => (
              <tr key={item.code}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{formatPercent(item.total_return)}</td>
                <td>{formatPercent(item.max_drawdown)}</td>
                <td>{formatPercent(item.volatility)}</td>
                <td>{formatNumber(item.sharpe_ratio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <InsightPanel
        title="对比口径"
        description="对比数据来自后端统一指标计算。"
        items={[
          { label: "基金数量", value: `${items.length} 只`, detail: "支持 2 到 8 只" },
          { label: "保存列表", value: accessToken ? "可用" : "需登录", detail: "使用现有账号接口" },
        ]}
        footnote="本页仅展示风险收益特征，不给出买卖建议。"
      />
    </main>
  );
}
