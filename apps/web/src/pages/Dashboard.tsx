import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AccountPanel } from "../components/AccountPanel";
import { listFunds, listIndices } from "../lib/api";
import { formatNumber } from "../lib/format";

export function Dashboard() {
  const [query, setQuery] = useState("");
  const fundsQuery = useQuery({
    queryKey: ["funds", query],
    queryFn: () => listFunds(query),
  });
  const indicesQuery = useQuery({
    queryKey: ["indices"],
    queryFn: listIndices,
  });
  const funds = fundsQuery.data?.items ?? [];
  const indices = indicesQuery.data?.items ?? [];
  const totalAssets = useMemo(
    () => funds.reduce((sum, fund) => sum + (fund.asset_size_billion ?? 0), 0),
    [funds],
  );

  return (
    <main className="page-grid">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Moon Fund Analytics</p>
          <h1>中国公募基金筛选与净值风险分析</h1>
          <p>
            第一版聚焦客观数据：搜索、筛选、详情页深度指标和多基金对比，不提供热门推荐或投资建议。
          </p>
        </div>
        <div className="overview-panel">
          <span>当前样本基金</span>
          <strong>{funds.length}</strong>
          <span>样本规模合计</span>
          <strong>{formatNumber(totalAssets, 1)} 亿</strong>
        </div>
      </section>

      <AccountPanel />

      <section className="index-strip">
        <div>
          <h2>指数与组合分析</h2>
          <p>海外宽基使用 Total Return 序列；组合回测支持基金和指数混合配置。</p>
        </div>
        <div className="index-card-grid">
          {indices.map((marketIndex) => (
            <Link className="index-card" to={`/indices/${marketIndex.code}`} key={marketIndex.code}>
              <span>{marketIndex.symbol}</span>
              <strong>{marketIndex.name}</strong>
              <small>
                {marketIndex.latest_date} · {formatNumber(marketIndex.latest_value, 2)}
              </small>
            </Link>
          ))}
          <Link className="index-card" to="/portfolio">
            <span>BACKTEST</span>
            <strong>组合回测</strong>
            <small>多资产权重配置 · 统一风险指标</small>
          </Link>
        </div>
      </section>

      <section className="toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索基金名称或代码，例如 沪深 / 000300"
        />
        <span>{fundsQuery.isFetching ? "加载中..." : `共 ${funds.length} 只`}</span>
      </section>

      <section className="table-shell">
        <table>
          <thead>
            <tr>
              <th>代码</th>
              <th>基金名称</th>
              <th>类型</th>
              <th>管理人</th>
              <th>最新净值</th>
              <th>规模(亿)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => (
              <tr key={fund.code}>
                <td>{fund.code}</td>
                <td>{fund.name}</td>
                <td>{fund.fund_type}</td>
                <td>{fund.manager}</td>
                <td>{formatNumber(fund.latest_nav, 4)}</td>
                <td>{formatNumber(fund.asset_size_billion, 1)}</td>
                <td>
                  <Link to={`/funds/${fund.code}`}>查看详情</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
