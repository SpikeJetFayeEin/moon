import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

async function source(path) {
  return readFile(resolve(webRoot, path), "utf8");
}

async function main() {
  const [app, api, syncDashboard, assetAnalysis, styles] = await Promise.all([
    source("src/App.tsx"),
    source("src/lib/api.ts"),
    source("src/pages/SyncDashboard.tsx"),
    source("src/pages/AssetAnalysis.tsx"),
    source("src/styles.css"),
  ]);

  assert.match(app, /<NavLink to="\/">数据同步<\/NavLink>/);
  assert.match(app, /<NavLink to="\/analysis\/fund\/000300">单项分析<\/NavLink>/);
  assert.match(app, /<Route path="\/" element=\{<SyncDashboard \/>\} \/>/);
  assert.match(app, /<Route path="\/analysis\/:assetType\/:code" element=\{<AssetAnalysis \/>\} \/>/);
  assert.doesNotMatch(app, /PortfolioBacktest|Compare|AuthButton|AuthCallback/);
  assert.doesNotMatch(app, /to="\/portfolio"|to="\/compare"|自选|全局基金检索/);

  assert.match(api, /export async function syncFund/);
  assert.match(api, /\/funds\/\$\{code\}\/sync/);
  assert.match(api, /export async function syncIndex/);
  assert.match(api, /\/indices\/\$\{code\}\/sync/);
  assert.match(api, /export async function deleteSyncedFund/);
  assert.match(api, /method: "DELETE"/);
  assert.match(api, /export async function deleteSyncedIndex/);
  assert.match(api, /export async function listSyncedFunds/);
  assert.match(api, /export async function searchFundCandidates/);
  assert.doesNotMatch(api, /backtestPortfolio|compareFunds|addWatchlistItem|saveCompareList/);

  assert.match(syncDashboard, /function SyncDashboard/);
  assert.match(syncDashboard, /listSyncedFunds/);
  assert.match(syncDashboard, /listIndices/);
  assert.match(syncDashboard, /searchFundCandidates/);
  assert.match(syncDashboard, /syncFund/);
  assert.match(syncDashboard, /syncIndex/);
  assert.match(syncDashboard, /deleteSyncedFund/);
  assert.match(syncDashboard, /deleteSyncedIndex/);
  assert.match(syncDashboard, /deleteFundMutation/);
  assert.match(syncDashboard, /deleteIndexMutation/);
  assert.match(syncDashboard, /数据同步看板/);
  assert.match(syncDashboard, /已同步资产/);
  assert.match(syncDashboard, /SyncedLedger/);
  assert.match(syncDashboard, /buildUnknownFundCandidate/);
  assert.match(syncDashboard, /buildUnknownIndexCandidate/);
  assert.match(syncDashboard, /搜索并添加未知基金/);
  assert.match(syncDashboard, /搜索并添加未知指数/);
  assert.match(syncDashboard, /删除/);
  assert.match(syncDashboard, /ledger-delete/);
  assert.match(syncDashboard, /完整数据同步/);
  assert.match(syncDashboard, /基础数据/);
  assert.match(syncDashboard, /to=\{`\/analysis\/fund\/\$\{selectedFund\.code\}`\}/);
  assert.match(syncDashboard, /to=\{`\/analysis\/index\/\$\{selectedIndex\.code\}`\}/);

  assert.match(assetAnalysis, /function AssetAnalysis/);
  assert.match(assetAnalysis, /assetType === "index"/);
  assert.match(assetAnalysis, /getFundMetrics/);
  assert.match(assetAnalysis, /getIndexMetrics/);
  assert.match(assetAnalysis, /NormalizedReturnChart/);
  assert.match(assetAnalysis, /DrawdownAreaChart/);
  assert.match(assetAnalysis, /AdvancedMetricsPanel/);
  assert.match(assetAnalysis, /多维度分析/);

  assert.match(styles, /\.sync-console/);
  assert.match(styles, /\.asset-switch/);
  assert.match(styles, /\.synced-ledger/);
  assert.match(styles, /\.ledger-list/);
  assert.match(styles, /\.ledger-delete/);
  assert.match(styles, /\.asset-analysis/);
  assert.match(styles, /\.sync-status/);
  assert.doesNotMatch(styles, /\.portfolio-|\.compare-/);
}

await main();
