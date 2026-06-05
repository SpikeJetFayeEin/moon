# Frontend Analytics Workbench Design

Date: 2026-06-05

Concept image: `docs/superpowers/specs/2026-06-05-frontend-analytics-workbench-concept.png`

## Goal

Upgrade Moon Fund Analytics from a clean but mostly static fund lookup site into a richer, more intuitive, and more professional analytical workbench.

The product remains objective fund analysis. It must not introduce fund recommendations, hot-fund promotion, buy/sell advice, or unsupported ratings.

## Recommended Direction

Use the professional investment workbench direction.

The interface should read in this order:

1. What is the current analytical context?
2. Which funds or indices are in scope?
3. What changed across return, drawdown, volatility, and holding quality?
4. Which chart or table provides the evidence?
5. Where can the user drill into fund detail, index detail, comparison, or portfolio backtest?

## Analytical Jobs

The redesign supports these data-visualization jobs:

- Comparison and ranking: fund table, comparison page, index peer table.
- Time change: cumulative return, normalized NAV, rolling returns.
- Risk and downside analysis: drawdown chart, max drawdown, volatility, VaR/CVaR.
- Distribution and composition: annual return bars, market heat buckets, portfolio contribution.
- Correlation-style positioning: risk-return scatter for funds, indices, and portfolios.
- Operational monitoring: stale/loading/error states, latest data date, source caveats.

## Visual System

Use a restrained financial terminal style:

- Background: true white and cool slate surfaces.
- Text: deep navy for primary content, slate for secondary labels.
- Accent: restrained blue for active navigation, chart primary series, and focus states.
- Semantic colors: red for positive China-market return convention where the current UI already uses it; emerald/green for drawdown and negative values where established.
- Radius: 8px or less.
- Borders: thin cool-gray borders with compact panel spacing.
- Avoid: decorative orbs, bokeh, purple gradients, beige/tan palette, glassmorphism, generic marketing hero layout, and chart-only decoration that does not encode data.

## App Shell

The header should become a compact analytical command bar:

- Brand: Moon Fund Analytics.
- Navigation: 筛选, 指数, 组合, 对比.
- Search: global fund/code/company search when practical; otherwise preserve page-local search and style it consistently.
- Account/watchlist status: keep existing Supabase/auth behavior without blocking anonymous exploration.
- Data status: show latest data date or source caveat where the page has evidence.

## Home Dashboard

The home page should become the main fund screening workbench.

Required modules:

- Left filter rail on desktop with fund type, style, company/manager placeholders if unsupported, size, inception date, and quick actions.
- Main overview band with index/fund context and latest available date.
- Search and quick filters for common fund or index terms.
- Fund table with richer scan columns: code, name, manager/company, type, size, latest NAV/date, key return, drawdown, and detail/compare actions.
- Bottom evidence grid with at least three chart families where data exists or can be derived from existing fixture/API data:
  - cumulative return line chart,
  - drawdown area chart,
  - annual return grouped bars or compact yearly rows,
  - risk-return scatter when comparing multiple items.
- Right insight rail on desktop with market/style summary, watchlist hints, today/recent movement when data supports it, and clear caveats.

Fallback behavior:

- If anonymous and no watchlist exists, use search prompt plus fixture/sample data already provided by the app.
- If API fails, preserve existing fixture fallback and show source caveats.
- Unsupported filters should be visually marked as disabled or "待接入", not silently fake-filtered.

## Fund Detail

The fund detail page already has the needed data. The redesign should improve organization and evidence density.

Required changes:

- Keep the side anchor menu on desktop, but make it visually lighter and more scannable.
- Add a compact profile/risk summary header with latest NAV, daily return, total return, annualized return, max drawdown, Sharpe, and data date.
- Group charts by reading path:
  - performance: cumulative return and stage/year returns,
  - downside: drawdown and tail-risk metrics,
  - holding quality: holding win rate, average/median return, sample count,
  - operations: profile, manager, benchmark/source caveats, recent NAV table.
- Keep unsupported holdings/fee modules honest with explicit "暂无可复核数据".

## Index Detail

The index detail page should match the fund detail visual system.

Required changes:

- Clarify total-return index source and normalized NAV method near the header.
- Pair index NAV and drawdown charts with the same chart styling used for funds.
- Keep the NDX/SPX peer comparison table, but add clearer visual hierarchy and source caveats.
- Place holding analysis controls near the holding evidence rather than making them feel like generic form fields.

## Compare Page

The compare page should move from separate mini charts to a coordinated comparison workspace.

Required changes:

- Keep comma-separated code input, saved comparison lists, and table.
- Add a shared normalized cumulative return chart for all compared funds.
- Add a shared drawdown chart or table so risk can be read alongside return.
- Add risk-return scatter with direct labels when two or more items exist.
- Keep individual mini charts as secondary, not the primary evidence.

## Portfolio Backtest

The portfolio page should feel like a decision workspace.

Required changes:

- Keep holdings editor, rebalance frequency, benchmark controls, and existing API call.
- Make weight total and validation more visible.
- Add allocation/contribution visualization from existing `contributions`.
- Keep NAV, drawdown, benchmark, and advanced metrics, but group them into return, risk, benchmark, and rebalance sections.
- Show rebalance dates compactly and avoid long unstructured text blocks.

## Components

Introduce focused reusable components instead of large one-off page markup:

- `WorkbenchShell` or page-level layout classes for header/body/sidebar/rail composition.
- `InsightPanel` for source caveats, data date, and explanatory text.
- `MetricStrip` or improved `MetricCard` variants for dense KPI rows.
- Shared chart helpers around Recharts:
  - normalized return line,
  - drawdown area,
  - yearly return bars,
  - risk-return scatter,
  - portfolio contribution bars.

Use existing React, Vite, TypeScript, TanStack Query, React Router, and Recharts. Do not add a new chart library unless Recharts blocks a required view.

## State and Persistence

Preserve existing data contracts and auth behavior.

Preferred state improvements:

- Search query and compare codes should remain URL-shareable where already supported.
- Filter state can remain local for this pass unless implementing real backend filtering.
- Selected comparison items and saved lists continue to use existing authenticated APIs.
- Invalid or unsupported state must be visible rather than silently ignored.

## Mobile Reading Path

Mobile is a primary surface.

Use this order:

1. Header/navigation.
2. Current context and data/source status.
3. Key metric strip.
4. Primary chart.
5. Filter/search controls.
6. Table/list.
7. Secondary charts and caveats.

Desktop sidebars and right insight rails collapse into ordered sections. Tables must remain horizontally scrollable only where unavoidable; key values should be available in compact rows/cards for narrow screens.

## Accessibility and Data Trust

Requirements:

- Essential values visible without hover.
- Tooltips supplement, but do not carry the only important value.
- Direct chart labels where practical.
- Sufficient contrast for slate text, red/green semantic colors, and blue active states.
- Keyboard-accessible buttons, inputs, tabs, and links.
- Explicit caveats for fallback fixtures, stale data, missing sources, and unsupported modules.
- No recommendation language.

## Verification

Implementation is not complete until these checks pass:

- `npm run build:web`.
- Browser verification of `/`, `/funds/000300`, `/indices/ndx`, `/portfolio`, and `/compare?codes=000300,110022`.
- Desktop screenshot review against the concept image for layout, hierarchy, palette, density, chart presence, table readability, and responsive behavior.
- Mobile viewport review for no clipping, no overlapping controls, readable key metrics, and usable chart/table order.
- Source/caveat review: unsupported data is marked honestly and no investment recommendation copy appears.

