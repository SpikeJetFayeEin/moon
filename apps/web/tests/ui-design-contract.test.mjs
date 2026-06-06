import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

async function source(path) {
  return readFile(resolve(webRoot, path), "utf8");
}

async function main() {
  const [styles, app, dashboard, fundDetail, indexDetail, portfolio, compare, queryStatePanel, api] = await Promise.all([
    source("src/styles.css"),
    source("src/App.tsx"),
    source("src/pages/Dashboard.tsx"),
    source("src/pages/FundDetail.tsx"),
    source("src/pages/IndexDetail.tsx"),
    source("src/pages/PortfolioBacktest.tsx"),
    source("src/pages/Compare.tsx"),
    source("src/components/QueryStatePanel.tsx"),
    source("src/lib/api.ts"),
  ]);

  assert.match(app, /className="terminal-header"/);
  assert.match(app, /submitGlobalSearch/);
  assert.match(app, /aria-label="全局基金检索"/);
  assert.match(dashboard, /useSearchParams/);
  assert.match(dashboard, /searchParams\.get\("q"\)/);
  assert.match(dashboard, /searchParams\.get\("type"\)/);
  assert.match(dashboard, /writeFilterParams/);
  assert.doesNotMatch(dashboard, /2025YTD/);
  assert.match(compare, /setSearchParams/);
  assert.match(compare, /normalizeCodes/);
  assert.doesNotMatch(compare, /风格标签/);
  assert.doesNotMatch(compare, /经理风格/);
  assert.match(compare, /deleteCompareList/);
  assert.match(compare, /compareListMessage/);
  assert.match(compare, /请先登录后保存对比列表/);
  assert.match(compare, /删除/);
  assert.match(queryStatePanel, /function QueryStatePanel/);
  assert.match(queryStatePanel, /state-panel/);
  assert.match(styles, /\.state-panel/);
  assert.match(dashboard, /QueryStatePanel/);
  assert.match(fundDetail, /QueryStatePanel/);
  assert.match(indexDetail, /QueryStatePanel/);
  assert.match(compare, /QueryStatePanel/);
  assert.match(api, /content-type/);
  assert.match(api, /application\/json/);
  assert.match(api, /AbortController/);
  assert.match(api, /API_REQUEST_TIMEOUT_MS/);
  assert.match(fundDetail, /NormalizedReturnChart/);
  assert.match(fundDetail, /DrawdownAreaChart/);
  assert.doesNotMatch(fundDetail, /buildReturnSeries/);
  assert.match(styles, /\.terminal-page/);
  assert.match(styles, /\.terminal-rail/);
  assert.match(styles, /\.terminal-right/);
  assert.match(styles, /\.terminal-table\s*{[\s\S]*overflow-x: auto/);
  assert.match(styles, /\.terminal-table table\s*{[\s\S]*min-width: 640px/);

  for (const page of [dashboard, indexDetail, portfolio, compare]) {
    assert.match(page, /terminal-page/);
  }

  for (const page of [dashboard, indexDetail, portfolio]) {
    assert.match(page, /terminal-rail/);
    assert.match(page, /terminal-right/);
  }

  assert.match(compare, /terminal-main/);
  assert.match(compare, /terminal-right/);

  assert.match(indexDetail, /指数筛选/);
  assert.match(indexDetail, /市场与风格洞察/);
  assert.match(portfolio, /组合构建/);
  assert.match(portfolio, /回测诊断/);
  assert.match(portfolio, /query\.refetch/);
  assert.match(portfolio, /保存模板（待接入）/);
  assert.match(portfolio, /交易成本（待接入）/);
  assert.match(compare, /对比洞察/);
  assert.match(compare, /核心指标对照/);
}

await main();
