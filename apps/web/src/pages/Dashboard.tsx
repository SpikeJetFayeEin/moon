import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AccountPanel } from "../components/AccountPanel";
import { listFunds, listIndices, listWatchlist } from "../lib/api";
import { formatNumber } from "../lib/format";
import { useSession } from "../hooks/useSession";

export function Dashboard() {
  const [query, setQuery] = useState("");
  const { accessToken, session } = useSession();
  const trimmedQuery = query.trim();
  const fundsQuery = useQuery({
    queryKey: ["funds", trimmedQuery],
    queryFn: () => listFunds(trimmedQuery),
    enabled: Boolean(trimmedQuery),
  });
  const watchlistQuery = useQuery({
    queryKey: ["watchlist", accessToken],
    queryFn: () => listWatchlist(accessToken),
    enabled: Boolean(accessToken) && !trimmedQuery,
  });
  const indicesQuery = useQuery({
    queryKey: ["indices"],
    queryFn: listIndices,
  });
  const funds = trimmedQuery ? (fundsQuery.data?.items ?? []) : (watchlistQuery.data ?? []);
  const indices = indicesQuery.data?.items ?? [];
  const totalAssets = useMemo(
    () => funds.reduce((sum, fund) => sum + (fund.asset_size_billion ?? 0), 0),
    [funds],
  );
  const latestFundCount = trimmedQuery ? fundsQuery.data?.total : funds.length;
  const quickSearches = ["沪深300", "中证500", "纳斯达克", "债券"];

  return (
    <main className="page-grid">
      <section className="hero-band">
        <div className="hero-copy">
          <h1>中国公募基金筛选与净值风险分析</h1>
          <p>
            第一版聚焦客观数据：搜索、筛选、详情页深度指标和多基金对比，不提供热门推荐或投资建议。
          </p>
          <div className="hero-actions">
            <a className="primary-button as-link" href="#fund-search">
              开始筛选
            </a>
            <Link className="ghost-button as-link" to="/portfolio">
              组合回测
            </Link>
          </div>
        </div>
        <div className="hero-insight-panel">
          <div className="overview-panel">
            <span>当前列表</span>
            <strong>{latestFundCount ?? funds.length}</strong>
            <small>{trimmedQuery ? "搜索结果" : "自选基金"}</small>
          </div>
          <div className="overview-panel">
            <span>规模合计</span>
            <strong>{formatNumber(totalAssets, 1)} 亿</strong>
            <small>按当前列表估算</small>
          </div>
          <div className="hero-mini-chart" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
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

      <section className="toolbar" id="fund-search">
        <div className="search-stack">
          <label htmlFor="fund-query">基金检索</label>
          <input
            id="fund-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索基金名称或代码，例如 沪深 / 000300"
          />
          <div className="quick-searches" aria-label="快捷搜索">
            {quickSearches.map((item) => (
              <button type="button" key={item} onClick={() => setQuery(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <span className="result-count">
          {fundsQuery.isFetching || watchlistQuery.isFetching ? "加载中..." : `共 ${funds.length} 只`}
        </span>
      </section>

      <section className="table-shell">
        {!trimmedQuery && !session ? (
          <p className="muted-note">登录后这里显示你的自选基金；也可以直接搜索基金名称或代码。</p>
        ) : !trimmedQuery && funds.length === 0 ? (
          <p className="muted-note">暂无自选基金。搜索基金并在详情页点击“保存自选”。</p>
        ) : (
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
                  <td>{fund.fund_type ?? "待同步"}</td>
                  <td>{fund.manager ?? "待同步"}</td>
                  <td>{formatNumber(fund.latest_nav, 4)}</td>
                  <td>{formatNumber(fund.asset_size_billion, 1)}</td>
                  <td>
                    <Link to={`/funds/${fund.code}`}>查看详情</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
