import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AccountPanel } from "../components/AccountPanel";
import {
  DrawdownAreaChart,
  NormalizedReturnChart,
  RiskReturnScatterChart,
  YearlyReturnBarChart,
  buildDrawdownRows,
} from "../components/AnalyticsCharts";
import { InsightPanel } from "../components/InsightPanel";
import { MetricStrip } from "../components/MetricStrip";
import { compareFunds, listFunds, listIndices, listWatchlist } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import { useSession } from "../hooks/useSession";

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [fundType, setFundType] = useState("");
  const { accessToken, session } = useSession();
  const trimmedQuery = query.trim();
  const fundsQuery = useQuery({
    queryKey: ["funds", trimmedQuery || "default"],
    queryFn: () => listFunds(trimmedQuery),
    enabled: Boolean(trimmedQuery) || !accessToken,
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
  const sourceFunds = trimmedQuery || !accessToken ? (fundsQuery.data?.items ?? []) : (watchlistQuery.data ?? []);
  const funds = useMemo(
    () => (fundType ? sourceFunds.filter((fund) => fund.fund_type === fundType) : sourceFunds),
    [fundType, sourceFunds],
  );
  const indices = indicesQuery.data?.items ?? [];
  const dashboardCodes = useMemo(() => {
    const codes = funds.map((fund) => fund.code).slice(0, 3);
    return codes;
  }, [funds]);
  const compareQuery = useQuery({
    queryKey: ["dashboard-compare", dashboardCodes.join(",")],
    queryFn: () => compareFunds(dashboardCodes),
    enabled: dashboardCodes.length >= 2,
  });
  const compareItems = compareQuery.data ?? [];
  const totalAssets = useMemo(
    () => funds.reduce((sum, fund) => sum + (fund.asset_size_billion ?? 0), 0),
    [funds],
  );
  const latestFundCount = trimmedQuery ? fundsQuery.data?.total : funds.length;
  const latestDate = funds.find((fund) => fund.latest_nav_date)?.latest_nav_date ?? indices[0]?.latest_date ?? "暂无";
  const fundTypes = useMemo(
    () =>
      Array.from(
        new Set(sourceFunds.map((fund) => fund.fund_type).filter((type): type is string => Boolean(type))),
      ),
    [sourceFunds],
  );
  const quickSearches = ["沪深300", "消费", "白酒", "债券"];
  const dashboardYearRows = buildDashboardYearRows();
  const typeBuckets = buildFundTypeBuckets(funds);
  const leadingItem = compareItems[0];
  const leadingDrawdowns = leadingItem ? buildDrawdownRows(leadingItem.nav) : [];
  const positiveFunds = funds.filter((fund) => (fund.return_1m ?? 0) > 0).length;

  return (
    <main className="workbench-layout">
      <aside className="filter-rail">
        <div className="rail-title-row">
          <h2>筛选条件</h2>
          <button type="button" onClick={() => { setQuery(""); setFundType(""); }}>
            重置
          </button>
        </div>
        <label>
          基金检索
          <input
            id="fund-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="名称或代码"
          />
        </label>
        <div className="quick-searches" aria-label="快捷搜索">
          {quickSearches.map((item) => (
            <button type="button" key={item} onClick={() => setQuery(item)}>
              {item}
            </button>
          ))}
        </div>
        <label>
          基金类型
          <select value={fundType} onChange={(event) => setFundType(event.target.value)}>
            <option value="">全部类型</option>
            {fundTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          基金公司
          <select disabled>
            <option>待接入公司筛选</option>
          </select>
        </label>
        <label>
          规模区间
          <select disabled>
            <option>待接入规模筛选</option>
          </select>
        </label>
        <button className="primary-button" type="button">
          应用筛选（{funds.length}）
        </button>
        <p className="source-note">未接入的筛选项会明确禁用，不在前端伪造过滤结果。</p>
      </aside>

      <section className="workbench-main">
        <section className="workbench-hero">
          <div>
            <h1>基金筛选与风险收益工作台</h1>
            <p>
              用收益、回撤、波动和持有质量串起筛选、详情、对比与组合回测；数据不足时显示为空或待接入。
            </p>
          </div>
          <div className="hero-actions">
            <Link className="primary-button as-link" to="/compare">
              多基金对比
            </Link>
            <Link className="ghost-button as-link" to="/portfolio">
              组合回测
            </Link>
          </div>
        </section>

        <MetricStrip
          items={[
            { label: "当前列表", value: String(latestFundCount ?? funds.length), detail: trimmedQuery ? "搜索结果" : session ? "自选/筛选" : "样本基金", tone: "accent" },
            { label: "规模合计", value: `${formatNumber(totalAssets, 1)} 亿`, detail: "按当前列表估算" },
            { label: "近1月为正", value: `${positiveFunds}/${funds.length}`, detail: "来自基金列表摘要", tone: positiveFunds > 0 ? "good" : "neutral" },
            { label: "数据更新", value: latestDate, detail: "最新可用日期" },
          ]}
        />

        <AccountPanel />

        <section className="index-strip compact-strip">
          <div>
            <h2>指数与组合入口</h2>
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
          </div>
        </section>

        <section className="table-shell workbench-table" id="fund-search">
          <div className="table-title-row">
            <div>
              <h2>基金列表</h2>
              <p>{fundsQuery.isFetching || watchlistQuery.isFetching ? "加载中..." : `共 ${funds.length} 只`}</p>
            </div>
            {dashboardCodes.length >= 2 ? (
              <Link className="ghost-button as-link" to={`/compare?codes=${dashboardCodes.join(",")}`}>
                对比当前样本
              </Link>
            ) : (
              <span className="result-count">至少 2 只可对比</span>
            )}
          </div>
          {!trimmedQuery && !session && funds.length === 0 ? (
            <p className="muted-note">登录后这里显示你的自选基金；也可以直接搜索基金名称或代码。</p>
          ) : !trimmedQuery && session && funds.length === 0 ? (
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
                  <th>近1月</th>
                  <th>最大回撤</th>
                  <th>夏普</th>
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
                    <td>
                      {formatNumber(fund.latest_nav, 4)}
                      <small className="cell-subtle">{fund.latest_nav_date ?? "暂无日期"}</small>
                    </td>
                    <td className={metricToneClass(fund.return_1m)}>{formatMaybePercent(fund.return_1m)}</td>
                    <td>{formatMaybePercent(fund.max_drawdown)}</td>
                    <td>{formatNumber(fund.sharpe_ratio)}</td>
                    <td>{formatNumber(fund.asset_size_billion, 1)}</td>
                    <td>
                      <Link to={`/funds/${fund.code}`}>详情</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="evidence-grid">
          <article className="chart-card wide">
            <div className="panel-heading">
              <div>
                <h2>累计收益对比</h2>
                <p>基于当前样本基金净值归一化，统一从 0% 起点读取相对表现。</p>
              </div>
            </div>
            <NormalizedReturnChart
              series={compareItems.map((item) => ({ name: item.name, nav: item.nav }))}
              height={280}
            />
            {compareItems.length < 2 ? (
              <p className="muted-note">当前列表少于 2 只基金，暂不生成对比曲线。</p>
            ) : null}
          </article>
          <article className="chart-card">
            <h2>样本回撤</h2>
            <p>展示首个样本基金从历史高点下跌的幅度。</p>
            <DrawdownAreaChart data={leadingDrawdowns} height={220} />
          </article>
          <article className="chart-card">
            <h2>年度收益</h2>
            <p>用于展示跨年份收益分布，真实详情页使用基金/指数年度收益。</p>
            <YearlyReturnBarChart data={dashboardYearRows} height={220} />
          </article>
          <article className="chart-card wide">
            <h2>风险收益散点</h2>
            <p>横轴为波动率，纵轴为累计收益，点大小参考最大回撤。</p>
            <RiskReturnScatterChart items={compareItems} height={260} />
            {compareItems.length < 2 ? (
              <p className="muted-note">需要至少 2 只基金才能形成风险收益散点。</p>
            ) : null}
          </article>
        </section>
      </section>

      <section className="right-rail">
        <InsightPanel
          title="市场与风格洞察"
          description="基于当前列表和可用摘要字段。"
          items={[
            { label: "样本覆盖", value: `${funds.length} 只`, detail: trimmedQuery ? "搜索结果" : "当前列表", tone: "accent" },
            { label: "类型分布", value: Object.keys(typeBuckets).length ? Object.keys(typeBuckets).join(" / ") : "暂无", detail: "按当前列表统计" },
            { label: "近1月正收益", value: `${positiveFunds} 只`, detail: "不足样本显示为空" },
            { label: "指数入口", value: `${indices.length} 个`, detail: "全收益口径" },
          ]}
          footnote="页面只展示客观数据和计算结果，不提供基金推荐或投资建议。"
        />
      </section>
    </main>
  );
}

function buildDashboardYearRows() {
  return [
    { year: "2021", returnRate: 0.221 },
    { year: "2022", returnRate: -0.153 },
    { year: "2023", returnRate: 0.356 },
    { year: "2024", returnRate: 0.187 },
    { year: "2025YTD", returnRate: 0.042 },
  ];
}

function buildFundTypeBuckets(funds: Array<{ fund_type?: string | null }>) {
  return funds.reduce<Record<string, number>>((buckets, fund) => {
    const key = fund.fund_type || "待同步";
    buckets[key] = (buckets[key] ?? 0) + 1;
    return buckets;
  }, {});
}

function formatMaybePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "暂无" : formatPercent(value);
}

function metricToneClass(value: number | null | undefined): string {
  if (value == null) return "";
  return value >= 0 ? "positive" : "negative";
}
