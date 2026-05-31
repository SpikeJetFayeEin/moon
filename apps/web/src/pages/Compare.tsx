import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { NavChart } from "../components/NavChart";
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

      <section className="analysis-layout">
        {(compareQuery.data ?? []).map((item) => (
          <article className="analysis-panel" key={item.code}>
            <h2>{item.name}</h2>
            <NavChart data={item.nav} height={220} />
          </article>
        ))}
      </section>
    </main>
  );
}
