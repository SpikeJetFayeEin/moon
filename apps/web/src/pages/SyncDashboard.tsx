import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MetricStrip } from "../components/MetricStrip";
import { QueryStatePanel } from "../components/QueryStatePanel";
import {
  deleteSyncedFund,
  deleteSyncedIndex,
  getReadiness,
  listIndices,
  listSyncedFunds,
  searchFundCandidates,
  syncFund,
  syncIndex,
} from "../lib/api";
import { formatNumber } from "../lib/format";
import type { Fund, MarketIndex, SyncResponse } from "../types";

export function SyncDashboard() {
  const queryClient = useQueryClient();
  const [fundQueryText, setFundQueryText] = useState("沪深");
  const [indexQueryText, setIndexQueryText] = useState("");
  const syncedFundsQuery = useQuery({
    queryKey: ["funds", "synced"],
    queryFn: listSyncedFunds,
  });
  const fundCandidatesQuery = useQuery({
    queryKey: ["funds", "candidates", fundQueryText],
    queryFn: () => searchFundCandidates(fundQueryText),
  });
  const indicesQuery = useQuery({ queryKey: ["indices"], queryFn: listIndices });
  const readinessQuery = useQuery({ queryKey: ["readiness"], queryFn: getReadiness });
  const syncedFunds = syncedFundsQuery.data?.items ?? [];
  const syncedIndices = indicesQuery.data?.items ?? [];
  const fundCandidates = useMemo(
    () => withUnknownFundCandidate(fundCandidatesQuery.data?.items ?? [], fundQueryText),
    [fundCandidatesQuery.data?.items, fundQueryText],
  );
  const indexCandidates = useMemo(
    () => withUnknownIndexCandidate(syncedIndices, indexQueryText),
    [indexQueryText, syncedIndices],
  );
  const [selectedFundCode, setSelectedFundCode] = useState("000300");
  const [selectedIndexCode, setSelectedIndexCode] = useState("ndx");
  const selectedFund = useMemo(
    () => fundCandidates.find((fund) => fund.code === selectedFundCode) ?? fundCandidates[0],
    [fundCandidates, selectedFundCode],
  );
  const selectedIndex = useMemo(
    () => indexCandidates.find((index) => index.code === selectedIndexCode) ?? indexCandidates[0],
    [indexCandidates, selectedIndexCode],
  );
  const syncFundMutation = useMutation({
    mutationFn: () => syncFund(selectedFund?.code ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["funds"] });
    },
  });
  const syncIndexMutation = useMutation({
    mutationFn: () => syncIndex(selectedIndex?.code ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["indices"] });
    },
  });
  const deleteFundMutation = useMutation({
    mutationFn: deleteSyncedFund,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["funds"] });
    },
  });
  const deleteIndexMutation = useMutation({
    mutationFn: deleteSyncedIndex,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["indices"] });
    },
  });

  return (
    <main className="sync-console">
      <section className="sync-hero">
        <div>
          <p className="eyebrow">Data Operations</p>
          <h1>数据同步看板</h1>
          <p>
            选择某个指数或基金，检查基础数据，然后触发完整数据同步到数据库。
          </p>
          <div className="hero-actions">
            {selectedFund ? (
              <Link className="ghost-button as-link" to={`/analysis/fund/${selectedFund.code}`}>
                当前基金分析
              </Link>
            ) : null}
            {selectedIndex ? (
              <Link className="ghost-button as-link" to={`/analysis/index/${selectedIndex.code}`}>
                当前指数分析
              </Link>
            ) : null}
          </div>
        </div>
        <MetricStrip
          items={[
            {
              label: "数据库",
              value: readinessQuery.data?.checks.supabase_database ? "已配置" : "降级",
              detail: readinessQuery.data?.status ?? "checking",
              tone: readinessQuery.data?.checks.supabase_database ? "good" : "bad",
            },
            {
              label: "外部源",
              value: readinessQuery.data?.checks.akshare_sync ? "AKShare" : "本地",
              detail: "基金数据源",
              tone: readinessQuery.data?.checks.akshare_sync ? "good" : "accent",
            },
            { label: "已同步基金", value: String(syncedFunds.length), detail: "数据库中" },
            { label: "已同步指数", value: String(syncedIndices.length), detail: "数据库中" },
            { label: "工作流", value: "2", detail: "同步 / 分析", tone: "accent" },
          ]}
        />
      </section>

      <SyncedLedger
        deleteFundError={deleteFundMutation.isError}
        deleteIndexError={deleteIndexMutation.isError}
        deletingFundCode={deleteFundMutation.isPending ? deleteFundMutation.variables : undefined}
        deletingIndexCode={deleteIndexMutation.isPending ? deleteIndexMutation.variables : undefined}
        funds={syncedFunds}
        indices={syncedIndices}
        onDeleteFund={(code) => deleteFundMutation.mutate(code)}
        onDeleteIndex={(code) => deleteIndexMutation.mutate(code)}
      />

      <section className="asset-switch">
        <AssetSyncPanel
          asset={selectedFund}
          assetType="fund"
          isLoading={fundCandidatesQuery.isLoading}
          items={fundCandidates}
          onSearch={setFundQueryText}
          onSelect={setSelectedFundCode}
          searchValue={fundQueryText}
          syncResult={syncFundMutation.data}
          syncStatus={syncFundMutation.status}
          onSync={() => syncFundMutation.mutate()}
        />
        <AssetSyncPanel
          asset={selectedIndex}
          assetType="index"
          isLoading={indicesQuery.isLoading}
          items={indexCandidates}
          onSearch={setIndexQueryText}
          onSelect={setSelectedIndexCode}
          searchValue={indexQueryText}
          syncResult={syncIndexMutation.data}
          syncStatus={syncIndexMutation.status}
          onSync={() => syncIndexMutation.mutate()}
        />
      </section>
    </main>
  );
}

function AssetSyncPanel({
  asset,
  assetType,
  isLoading,
  items,
  onSearch,
  onSelect,
  searchValue,
  syncResult,
  syncStatus,
  onSync,
}: {
  asset: Fund | MarketIndex | undefined;
  assetType: "fund" | "index";
  isLoading: boolean;
  items: Array<Fund | MarketIndex>;
  onSearch?: (value: string) => void;
  onSelect: (code: string) => void;
  searchValue?: string;
  syncResult?: SyncResponse;
  syncStatus: "idle" | "pending" | "success" | "error";
  onSync: () => void;
}) {
  const isFund = assetType === "fund";
  const title = isFund ? "基金完整数据同步" : "指数完整数据同步";
  const searchLabel = isFund ? "搜索并添加未知基金" : "搜索并添加未知指数";

  return (
    <article className="sync-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{isFund ? "Fund" : "Index"}</p>
          <h2>{title}</h2>
        </div>
        {asset ? (
          <Link className="ghost-button as-link" to={`/analysis/${assetType}/${asset.code}`}>
            深度分析
          </Link>
        ) : null}
      </div>

      {onSearch ? (
        <label className="sync-search">
          {searchLabel}
          <input
            onChange={(event) => onSearch(event.target.value)}
            placeholder={isFund ? "输入基金代码或名称" : "输入指数代码、名称或 Yahoo 符号"}
            value={searchValue}
          />
        </label>
      ) : null}

      {isLoading ? (
        <QueryStatePanel title="正在读取资产列表" description="正在加载可同步的基础数据。" tone="loading" />
      ) : (
        <div className="candidate-list" role="listbox">
          {items.map((item) => (
            <button
              className={asset?.code === item.code ? "active" : ""}
              key={item.code}
              onClick={() => onSelect(item.code)}
              type="button"
            >
              <strong>{item.code}</strong>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {asset ? (
        <>
          <BasicData asset={asset} assetType={assetType} />
          <div className="sync-actions">
            <button
              className="primary-button"
              disabled={syncStatus === "pending"}
              onClick={onSync}
              type="button"
            >
              {syncStatus === "pending" ? "同步中..." : "完整数据同步"}
            </button>
            <Link
              className="ghost-button as-link"
              to={
                assetType === "fund"
                  ? `/analysis/fund/${(asset as Fund).code}`
                  : `/analysis/index/${(asset as MarketIndex).code}`
              }
            >
              打开分析
            </Link>
          </div>
          <SyncStatus result={syncResult} status={syncStatus} />
        </>
      ) : (
        <QueryStatePanel title="暂无资产" description="请调整搜索条件或检查数据源配置。" tone="error" />
      )}
    </article>
  );
}

function SyncedLedger({
  deleteFundError,
  deleteIndexError,
  deletingFundCode,
  deletingIndexCode,
  funds,
  indices,
  onDeleteFund,
  onDeleteIndex,
}: {
  deleteFundError: boolean;
  deleteIndexError: boolean;
  deletingFundCode?: string;
  deletingIndexCode?: string;
  funds: Fund[];
  indices: MarketIndex[];
  onDeleteFund: (code: string) => void;
  onDeleteIndex: (code: string) => void;
}) {
  return (
    <section className="synced-ledger">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Database Ledger</p>
          <h2>已同步资产</h2>
        </div>
        <span>{funds.length + indices.length} 个资产</span>
      </div>
      {deleteFundError || deleteIndexError ? (
        <div className="sync-status error">删除失败，请检查后端数据库连接或约束配置。</div>
      ) : null}
      <div className="ledger-list">
        <div>
          <h3>基金</h3>
          {funds.map((fund) => (
            <div className="ledger-item" key={fund.code}>
              <Link to={`/analysis/fund/${fund.code}`}>
                <strong>{fund.code}</strong>
                <span>{fund.name}</span>
                <small>{fund.latest_nav_date ?? "暂无净值日期"}</small>
              </Link>
              <button
                className="ledger-delete"
                disabled={deletingFundCode === fund.code}
                onClick={() => onDeleteFund(fund.code)}
                type="button"
              >
                {deletingFundCode === fund.code ? "删除中" : "删除"}
              </button>
            </div>
          ))}
        </div>
        <div>
          <h3>指数</h3>
          {indices.map((index) => (
            <div className="ledger-item" key={index.code}>
              <Link to={`/analysis/index/${index.code}`}>
                <strong>{index.code}</strong>
                <span>{index.name}</span>
                <small>{index.latest_date}</small>
              </Link>
              <button
                className="ledger-delete"
                disabled={deletingIndexCode === index.code}
                onClick={() => onDeleteIndex(index.code)}
                type="button"
              >
                {deletingIndexCode === index.code ? "删除中" : "删除"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BasicData({ asset, assetType }: { asset: Fund | MarketIndex; assetType: "fund" | "index" }) {
  if (assetType === "fund") {
    const fund = asset as Fund;
    return (
      <div className="basic-data">
        <h3>基础数据</h3>
        <dl>
          <div><dt>基金名称</dt><dd>{fund.name}</dd></div>
          <div><dt>基金类型</dt><dd>{fund.fund_type}</dd></div>
          <div><dt>管理人</dt><dd>{fund.manager}</dd></div>
          <div><dt>基金经理</dt><dd>{fund.fund_manager ?? "待同步"}</dd></div>
          <div><dt>成立日期</dt><dd>{fund.inception_date}</dd></div>
          <div><dt>最新净值</dt><dd>{formatNumber(fund.latest_nav, 4)}</dd></div>
          <div><dt>净值日期</dt><dd>{fund.latest_nav_date ?? "待同步"}</dd></div>
          <div><dt>规模</dt><dd>{formatNumber(fund.asset_size_billion, 2)} 亿</dd></div>
        </dl>
      </div>
    );
  }

  const marketIndex = asset as MarketIndex;
  return (
    <div className="basic-data">
      <h3>基础数据</h3>
      <dl>
        <div><dt>指数名称</dt><dd>{marketIndex.name}</dd></div>
        <div><dt>代码</dt><dd>{marketIndex.code}</dd></div>
        <div><dt>符号</dt><dd>{marketIndex.symbol}</dd></div>
        <div><dt>收益口径</dt><dd>{marketIndex.return_type}</dd></div>
        <div><dt>币种</dt><dd>{marketIndex.currency}</dd></div>
        <div><dt>数据源</dt><dd>{marketIndex.provider}</dd></div>
        <div><dt>最新点位</dt><dd>{formatNumber(marketIndex.latest_value, 2)}</dd></div>
        <div><dt>更新日期</dt><dd>{marketIndex.latest_date}</dd></div>
      </dl>
      <p>{marketIndex.description}</p>
    </div>
  );
}

function withUnknownFundCandidate(items: Fund[], query: string): Fund[] {
  const unknown = buildUnknownFundCandidate(query, items);
  return unknown ? [unknown, ...items] : items;
}

function buildUnknownFundCandidate(query: string, items: Fund[]): Fund | null {
  const code = query.trim();
  if (!/^\d{6}$/.test(code)) return null;
  if (items.some((item) => item.code === code)) return null;
  return {
    code,
    name: `待同步基金 ${code}`,
    fund_type: "待同步",
    manager: "待同步",
    fund_manager: null,
    inception_date: "1970-01-01",
    latest_nav: null,
    latest_nav_date: null,
    asset_size_billion: null,
  };
}

function withUnknownIndexCandidate(items: MarketIndex[], query: string): MarketIndex[] {
  const filtered = filterIndexCandidates(items, query);
  const unknown = buildUnknownIndexCandidate(query, items);
  return unknown ? [unknown, ...filtered] : filtered;
}

function filterIndexCandidates(items: MarketIndex[], query: string): MarketIndex[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return items;
  return items.filter((item) =>
    [item.code, item.name, item.symbol].some((value) => value.toLowerCase().includes(keyword)),
  );
}

function buildUnknownIndexCandidate(query: string, items: MarketIndex[]): MarketIndex | null {
  const code = query.trim().toLowerCase();
  if (!/^[a-z0-9.^-]{2,16}$/.test(code)) return null;
  if (items.some((item) => item.code === code || item.symbol.toLowerCase() === code)) return null;
  return {
    code,
    name: `待同步指数 ${code.toUpperCase()}`,
    symbol: code.toUpperCase(),
    return_type: "price",
    currency: "USD",
    provider: "Yahoo Finance",
    description: "通过搜索框添加的指数候选，首次同步后写入数据库。",
    latest_value: 0,
    latest_date: new Date().toISOString().slice(0, 10),
  };
}

function SyncStatus({
  result,
  status,
}: {
  result?: SyncResponse;
  status: "idle" | "pending" | "success" | "error";
}) {
  if (status === "idle") {
    return <div className="sync-status">等待同步操作。</div>;
  }
  if (status === "pending") {
    return <div className="sync-status loading">正在同步完整数据，请等待接口返回。</div>;
  }
  if (status === "error") {
    return <div className="sync-status error">同步失败，请检查后端数据源和数据库配置。</div>;
  }
  return (
    <div className={result?.status === "synced" ? "sync-status success" : "sync-status"}>
      <strong>{result?.status === "synced" ? "同步完成" : "已跳过"}</strong>
      <span>
        元数据 {result?.items_seen ?? 0} 条，净值 {result?.nav_rows_seen ?? 0} 行，时间 {result?.synced_at}
      </span>
    </div>
  );
}
