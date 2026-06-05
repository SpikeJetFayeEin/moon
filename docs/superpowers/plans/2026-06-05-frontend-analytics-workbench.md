# Frontend Analytics Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Moon Fund Analytics into a richer, more intuitive, and more professional fund analysis workbench across the dashboard, detail, index, compare, and portfolio pages.

**Architecture:** Keep the current React/Vite app, API contracts, fixture fallbacks, auth behavior, and Recharts dependency. Add shared chart and presentation components, then refactor pages to use a consistent analytical reading path: context, key metrics, primary evidence, secondary detail, and source caveats.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, React Router, Recharts, CSS modules via the existing global `styles.css`.

---

## File Structure

- Create `apps/web/src/components/InsightPanel.tsx`: compact source/caveat and insight rows.
- Create `apps/web/src/components/MetricStrip.tsx`: dense KPI strip with semantic tone support.
- Create `apps/web/src/components/AnalyticsCharts.tsx`: shared Recharts views for normalized returns, drawdowns, yearly returns, risk-return scatter, and contribution bars.
- Modify `apps/api/app/models/schemas.py`: add optional fund-list and watchlist risk/return summary fields.
- Modify `apps/api/app/api/routes.py`: enrich fund-list and watchlist rows from existing NAV metrics when data exists.
- Modify `apps/api/tests/test_api.py`: verify summary fields are returned for fund list and authenticated watchlist.
- Modify `apps/web/src/App.tsx`: compact analytical command bar and route-aware global search affordance.
- Modify `apps/web/src/pages/Dashboard.tsx`: main fund screening workbench with filter rail, richer table, overview, evidence charts, and insight rail.
- Modify `apps/web/src/pages/FundDetail.tsx`: denser summary header and more coherent evidence sections.
- Modify `apps/web/src/pages/IndexDetail.tsx`: match fund-detail visual system and clarify total-return source.
- Modify `apps/web/src/pages/Compare.tsx`: shared normalized return, drawdown, and risk-return evidence.
- Modify `apps/web/src/pages/PortfolioBacktest.tsx`: contribution/allocation evidence, weight validation, grouped result sections.
- Modify `apps/web/src/styles.css`: new visual system, workbench layout, chart panels, mobile collapse.

## Task 1: Shared Presentation Components

**Files:**
- Create: `apps/web/src/components/InsightPanel.tsx`
- Create: `apps/web/src/components/MetricStrip.tsx`

- [ ] **Step 1: Add `InsightPanel`**

Create:

```tsx
type InsightPanelItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad" | "accent";
};

type InsightPanelProps = {
  title: string;
  description?: string;
  items: InsightPanelItem[];
  footnote?: string;
};

export function InsightPanel({ title, description, items, footnote }: InsightPanelProps) {
  return (
    <aside className="insight-panel">
      <div className="panel-heading compact">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="insight-list">
        {items.map((item) => (
          <div className={`insight-row ${item.tone ?? "neutral"}`} key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </div>
        ))}
      </div>
      {footnote ? <p className="source-note">{footnote}</p> : null}
    </aside>
  );
}
```

## Task 1A: Backend List Summary Data

**Files:**
- Modify: `apps/api/app/models/schemas.py`
- Modify: `apps/api/app/api/routes.py`
- Test: `apps/api/tests/test_api.py`

- [x] **Step 1: Add failing API tests**

Add assertions that `/funds` and authenticated `/watchlist` responses include summary fields:

```python
assert item["return_1m"] is not None
assert item["drawdown_1m"] is not None
assert "return_1y" in item
assert "drawdown_1y" in item
assert item["max_drawdown"] is not None
assert item["volatility"] is not None
assert item["sharpe_ratio"] is not None
```

- [x] **Step 2: Add optional schema fields**

Add `return_1m`, `drawdown_1m`, `return_1y`, `drawdown_1y`, `max_drawdown`, `volatility`, and `sharpe_ratio` to `Fund` and `WatchlistItem`.

- [x] **Step 3: Enrich list rows from NAV metrics**

Use existing `calculate_fund_metrics` in `apps/api/app/api/routes.py` to enrich rows when at least two NAV points exist. Leave fields null when data is insufficient.

- [x] **Step 4: Verify**

Run:

```powershell
uv run pytest tests/test_api.py::test_fund_list_items_include_risk_return_summary -q
uv run pytest tests/test_api.py::test_authenticated_user_can_manage_watchlist -q
```

- [ ] **Step 2: Add `MetricStrip`**

Create:

```tsx
export type MetricStripItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad" | "accent";
};

type MetricStripProps = {
  items: MetricStripItem[];
  className?: string;
};

export function MetricStrip({ items, className = "" }: MetricStripProps) {
  return (
    <section className={`metric-strip ${className}`}>
      {items.map((item) => (
        <div className={`metric-tile ${item.tone ?? "neutral"}`} key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </section>
  );
}
```

## Task 2: Shared Analytics Charts

**Files:**
- Create: `apps/web/src/components/AnalyticsCharts.tsx`

- [ ] **Step 1: Add chart helpers**

Create typed chart components:

```tsx
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { formatNumber, formatPercent } from "../lib/format";
import type { CompareItem, DrawdownPoint, NavPoint, PortfolioContribution } from "../types";

export type NamedNavSeries = {
  name: string;
  color?: string;
  nav: NavPoint[];
};

export function buildNormalizedReturnRows(series: NamedNavSeries[]) {
  const dates = new Map<string, Record<string, number | string>>();
  for (const item of series) {
    const basePoint = item.nav[0];
    const base = basePoint ? basePoint.accumulated_nav ?? basePoint.nav : 0;
    if (!base) continue;
    for (const point of item.nav) {
      const row = dates.get(point.date) ?? { date: point.date };
      row[item.name] = (point.accumulated_nav ?? point.nav) / base - 1;
      dates.set(point.date, row);
    }
  }
  return Array.from(dates.values()).sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
}

export function NormalizedReturnChart({ series, height = 260 }: { series: NamedNavSeries[]; height?: number }) {
  const rows = buildNormalizedReturnRows(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <Legend />
        {series.map((item, index) => (
          <Line
            dataKey={item.name}
            dot={false}
            key={item.name}
            name={item.name}
            stroke={item.color ?? chartColors[index % chartColors.length]}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DrawdownAreaChart({ data, height = 240 }: { data: DrawdownPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <Area dataKey="drawdown" fill="#dbeafe" name="回撤" stroke="#2563eb" type="monotone" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function YearlyReturnBarChart({ data, height = 240 }: { data: Array<{ year: string; returnRate: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Bar dataKey="returnRate" name="年度收益" radius={[4, 4, 0, 0]}>
          {data.map((row) => (
            <Cell fill={row.returnRate >= 0 ? "#dc2626" : "#059669"} key={row.year} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RiskReturnScatterChart({ items, height = 260 }: { items: CompareItem[]; height?: number }) {
  const rows = items.map((item) => ({
    name: item.name,
    code: item.code,
    returnRate: item.total_return,
    volatility: item.volatility,
    size: Math.max(80, Math.abs(item.max_drawdown) * 900),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis
          dataKey="volatility"
          name="波动率"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatPercent(Number(value))}
          type="number"
        />
        <YAxis
          dataKey="returnRate"
          name="累计收益"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatPercent(Number(value))}
          type="number"
        />
        <ZAxis dataKey="size" range={[90, 360]} />
        <Tooltip
          formatter={(value, name) =>
            name === "size" ? formatNumber(Number(value), 0) : formatPercent(Number(value))
          }
          labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
        />
        <Scatter data={rows} fill="#2563eb" name="风险收益" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function ContributionBarChart({ items, height = 240 }: { items: PortfolioContribution[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} type="number" />
        <YAxis dataKey="code" tick={{ fontSize: 11 }} type="category" width={76} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <ReferenceLine x={0} stroke="#94a3b8" />
        <Bar dataKey="contribution" name="收益贡献" radius={[0, 4, 4, 0]}>
          {items.map((item) => (
            <Cell fill={item.contribution >= 0 ? "#dc2626" : "#059669"} key={`${item.asset_type}-${item.code}`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const chartColors = ["#2563eb", "#f97316", "#14b8a6", "#7c3aed", "#64748b", "#dc2626", "#0891b2", "#9333ea"];
```

## Task 3: Dashboard Workbench

**Files:**
- Modify: `apps/web/src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace the hero layout with workbench layout**

Use the existing queries, then render:

- `main.workbench-layout`
- `aside.filter-rail`
- `section.workbench-main`
- `aside.right-rail`

Keep existing `listFunds`, `listIndices`, `listWatchlist`, `AccountPanel`, `useSession`, quick searches, and table links.

- [ ] **Step 2: Add derived dashboard evidence**

Add local helpers inside `Dashboard.tsx`:

```tsx
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
```

These are visual summaries of the currently visible list and static market context, not investment advice.

- [ ] **Step 3: Enrich the fund table**

Table columns should include:

- 代码
- 基金名称
- 类型
- 管理人
- 最新净值
- 最新日期
- 规模(亿)
- 动作

Unsupported rank/return fields should not be fabricated in the table.

## Task 4: Fund and Index Detail Refinement

**Files:**
- Modify: `apps/web/src/pages/FundDetail.tsx`
- Modify: `apps/web/src/pages/IndexDetail.tsx`

- [ ] **Step 1: Use `MetricStrip` for top metrics**

Replace dense one-off metric grids where appropriate with `MetricStrip` items.

- [ ] **Step 2: Use shared charts**

Replace duplicated Recharts blocks with:

- `NormalizedReturnChart`
- `DrawdownAreaChart`
- `YearlyReturnBarChart`

Keep any page-specific chart only when it has a distinct purpose.

- [ ] **Step 3: Add explicit source and caveat panels**

Use `InsightPanel` with page-specific caveats:

- Fund detail: "基准曲线和同类平均需要接入可复核时序数据后展示。"
- Index detail: "指数页面展示为首日归一化净值；全收益口径含分红再投资。"

## Task 5: Compare and Portfolio Evidence

**Files:**
- Modify: `apps/web/src/pages/Compare.tsx`
- Modify: `apps/web/src/pages/PortfolioBacktest.tsx`

- [ ] **Step 1: Compare page shared evidence**

Add:

- shared normalized cumulative return chart for all compared funds,
- risk-return scatter,
- existing table retained above or beside chart evidence.

- [ ] **Step 2: Portfolio contribution and validation**

Add:

- visible weight total state with good/bad tone,
- contribution bar chart from `result.contributions`,
- compact benchmark/advanced metric insight panels.

## Task 6: Visual System and Responsive CSS

**Files:**
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Add workbench tokens and layout classes**

Add styles for:

- `.workbench-layout`
- `.filter-rail`
- `.workbench-main`
- `.right-rail`
- `.metric-strip`
- `.metric-tile`
- `.insight-panel`
- `.insight-row`
- `.chart-card`
- `.evidence-grid`
- `.source-note`

- [ ] **Step 2: Tighten existing app shell**

Keep brand and nav but make the shell read as an analytical command bar:

- compact height,
- readable navigation,
- no oversized marketing hero defaults on app pages,
- mobile wrapping without overlap.

- [ ] **Step 3: Mobile collapse**

At `max-width: 1000px`, collapse workbench layout to one column and order:

1. context,
2. metrics,
3. primary chart,
4. filters/search,
5. table,
6. secondary charts,
7. caveats.

## Task 7: Verification

**Files:**
- Inspect all modified files.
- Update `docs/verification.md` only if verification commands or results materially change.

- [ ] **Step 1: Type/build verification**

Run:

```powershell
npm run build:web
```

Expected: TypeScript and Vite production build complete with exit code 0.

- [ ] **Step 2: Browser verification**

Run the app and verify:

- `/`
- `/funds/000300`
- `/indices/ndx`
- `/portfolio`
- `/compare?codes=000300,110022`

Expected: no page errors, no obvious layout clipping, visible charts/tables/caveats, mobile layout remains usable.

- [ ] **Step 3: Design fidelity check**

Compare the rendered dashboard against `docs/superpowers/specs/2026-06-05-frontend-analytics-workbench-concept.png` for:

- app shell and navigation,
- left filter rail,
- table density,
- chart evidence area,
- right insight rail,
- cool slate/blue/red/green palette,
- 8px-or-less panel geometry,
- no investment recommendation copy.
