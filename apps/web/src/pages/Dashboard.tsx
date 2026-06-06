import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { QueryStatePanel } from "../components/QueryStatePanel";
import { compareFunds, listFunds, listIndices, listWatchlist } from "../lib/api";
import { formatNumber, formatPercent } from "../lib/format";
import { useSession } from "../hooks/useSession";
import type { NavPoint } from "../types";

type FundSortOption = "default" | "return_1m" | "drawdown" | "sharpe" | "size";

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlFundType = searchParams.get("type") ?? "";
  const urlSort = searchParams.get("sort") ?? "default";
  const [query, setQuery] = useState(urlQuery);
  const [fundType, setFundType] = useState(urlFundType);
  const [sortOption, setSortOption] = useState<FundSortOption>(normalizeSortOption(urlSort));
  const { accessToken, session } = useSession();
  const trimmedQuery = query.trim();

  useEffect(() => {
    setQuery(urlQuery);
    setFundType(urlFundType);
    setSortOption(normalizeSortOption(urlSort));
  }, [urlFundType, urlQuery, urlSort]);

  function writeFilterParams(nextQuery: string, nextFundType: string, nextSortOption: FundSortOption) {
    const nextParams: Record<string, string> = {};
    const trimmed = nextQuery.trim();
    if (trimmed) nextParams.q = trimmed;
    if (nextFundType) nextParams.type = nextFundType;
    if (nextSortOption !== "default") nextParams.sort = nextSortOption;
    setSearchParams(nextParams);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    writeFilterParams(nextQuery, fundType, sortOption);
  }

  function updateFundType(nextFundType: string) {
    setFundType(nextFundType);
    writeFilterParams(query, nextFundType, sortOption);
  }

  function updateSortOption(nextSortOption: FundSortOption) {
    setSortOption(nextSortOption);
    writeFilterParams(query, fundType, nextSortOption);
  }

  function resetFilters() {
    setQuery("");
    setFundType("");
    setSortOption("default");
    setSearchParams({});
  }

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
  const sortedFunds = useMemo(() => sortFunds(funds, sortOption), [funds, sortOption]);
  const indices = indicesQuery.data?.items ?? [];
  const dashboardCodes = useMemo(() => {
    const codes = sortedFunds.map((fund) => fund.code).slice(0, 3);
    return codes;
  }, [sortedFunds]);
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
  const visibleFundTypes = useMemo(
    () => (fundType && !fundTypes.includes(fundType) ? [fundType, ...fundTypes] : fundTypes),
    [fundType, fundTypes],
  );
  const quickSearches = ["沪深300", "消费", "白酒", "债券"];
  const typeBuckets = buildFundTypeBuckets(funds);
  const leadingItem = compareItems[0];
  const leadingDrawdowns = leadingItem ? buildDrawdownRows(leadingItem.nav) : [];
  const dashboardYearRows = useMemo(
    () => buildDashboardYearRows(leadingItem?.nav ?? []),
    [leadingItem],
  );
  const positiveFunds = funds.filter((fund) => (fund.return_1m ?? 0) > 0).length;
  const listIsFetching = fundsQuery.isFetching || watchlistQuery.isFetching;
  const listIsError = fundsQuery.isError || watchlistQuery.isError;

  return (
    <main className="terminal-page">
      <aside className="terminal-rail">
        <div className="terminal-title-row">
          <h2>筛选条件</h2>
          <button type="button" onClick={resetFilters}>
            重置
          </button>
        </div>
        <label>
          基金检索
          <input
            id="fund-query"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="名称或代码"
          />
        </label>
        <div className="quick-searches" aria-label="快捷搜索">
          {quickSearches.map((item) => (
            <button type="button" key={item} onClick={() => updateQuery(item)}>
              {item}
            </button>
          ))}
        </div>
        <label>
          基金类型
          <select value={fundType} onChange={(event) => updateFundType(event.target.value)}>
            <option value="">全部类型</option>
            {visibleFundTypes.map((type) => (
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
        <button className="primary-button" type="button" onClick={() => writeFilterParams(query, fundType, sortOption)}>
          应用筛选（{funds.length}）
        </button>
        <p className="source-note">未接入的筛选项会明确禁用，不在前端伪造过滤结果。</p>
      </aside>

      <section className="terminal-main">
        <section className="terminal-card terminal-hero">
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

        <section className="terminal-table" id="fund-search">
          <div className="table-title-row">
            <div>
              <h2>基金列表</h2>
              <p>{listIsFetching ? "加载中..." : `共 ${funds.length} 只`}</p>
            </div>
            <div className="table-actions">
              <label className="table-sort-control">
                排序
                <select
                  aria-label="基金列表排序"
                  value={sortOption}
                  onChange={(event) => updateSortOption(normalizeSortOption(event.target.value))}
                >
                  <option value="default">默认排序</option>
                  <option value="return_1m">近1月收益优先</option>
                  <option value="drawdown">回撤较小优先</option>
                  <option value="sharpe">夏普较高优先</option>
                  <option value="size">规模较大优先</option>
                </select>
              </label>
              {dashboardCodes.length >= 2 ? (
                <Link className="ghost-button as-link" to={`/compare?codes=${dashboardCodes.join(",")}`}>
                  对比当前样本
                </Link>
              ) : (
                <span className="result-count">至少 2 只可对比</span>
              )}
            </div>
          </div>
          {listIsError ? (
            <QueryStatePanel
              title="基金列表加载失败"
              description="请稍后重试；未登录状态仍可通过基金名称或代码搜索样本数据。"
              tone="error"
            />
          ) : listIsFetching && funds.length === 0 ? (
            <QueryStatePanel title="正在加载基金列表" description="正在同步基金、指数和自选列表。" tone="loading" />
          ) : !trimmedQuery && !session && funds.length === 0 ? (
            <QueryStatePanel
              title="暂无本地列表"
              description="登录后这里显示你的自选基金；也可以直接搜索基金名称或代码。"
            />
          ) : !trimmedQuery && session && funds.length === 0 ? (
            <QueryStatePanel
              title="暂无自选基金"
              description="搜索基金并在详情页点击“保存自选”，这里会变成你的观察列表。"
            />
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
                {sortedFunds.map((fund) => (
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
            <p>从当前样本首只基金净值按自然年首尾值推导，不使用固定示例收益。</p>
            <YearlyReturnBarChart data={dashboardYearRows} height={220} />
            {!dashboardYearRows.length ? (
              <p className="muted-note">当前样本净值不足以生成年度收益。</p>
            ) : null}
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

      <section className="terminal-right">
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

function buildDashboardYearRows(nav: NavPoint[]) {
  const yearly = new Map<string, { first: number; last: number }>();
  for (const point of [...nav].sort((left, right) => left.date.localeCompare(right.date))) {
    const year = point.date.slice(0, 4);
    const value = point.accumulated_nav ?? point.nav;
    if (!year || !value) continue;
    const row = yearly.get(year) ?? { first: value, last: value };
    row.last = value;
    yearly.set(year, row);
  }
  return Array.from(yearly.entries())
    .map(([year, row]) => ({ year, returnRate: row.first ? row.last / row.first - 1 : 0 }))
    .filter((row) => Number.isFinite(row.returnRate));
}

function buildFundTypeBuckets(funds: Array<{ fund_type?: string | null }>) {
  return funds.reduce<Record<string, number>>((buckets, fund) => {
    const key = fund.fund_type || "待同步";
    buckets[key] = (buckets[key] ?? 0) + 1;
    return buckets;
  }, {});
}

function normalizeSortOption(value: string): FundSortOption {
  if (value === "return_1m" || value === "drawdown" || value === "sharpe" || value === "size") {
    return value;
  }
  return "default";
}

function sortFunds<T extends {
  code: string;
  return_1m?: number | null;
  max_drawdown?: number | null;
  sharpe_ratio?: number | null;
  asset_size_billion?: number | null;
}>(funds: T[], sortOption: FundSortOption): T[] {
  if (sortOption === "default") return funds;

  const fieldBySort: Record<Exclude<FundSortOption, "default">, keyof T> = {
    return_1m: "return_1m",
    drawdown: "max_drawdown",
    sharpe: "sharpe_ratio",
    size: "asset_size_billion",
  };
  const field = fieldBySort[sortOption];

  return [...funds].sort((left, right) => {
    const leftValue = readSortableNumber(left[field]);
    const rightValue = readSortableNumber(right[field]);
    if (leftValue == null && rightValue == null) return left.code.localeCompare(right.code);
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    if (leftValue === rightValue) return left.code.localeCompare(right.code);
    return rightValue - leftValue;
  });
}

function readSortableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMaybePercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "暂无" : formatPercent(value);
}

function metricToneClass(value: number | null | undefined): string {
  if (value == null) return "";
  return value >= 0 ? "positive" : "negative";
}
