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

type YearlyReturn = {
  year: string;
  returnRate: number;
};

const chartColors = ["#2563eb", "#f97316", "#14b8a6", "#7c3aed", "#64748b", "#dc2626", "#0891b2", "#9333ea"];

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

export function buildDrawdownRows(nav: NavPoint[]): DrawdownPoint[] {
  let peak = 0;
  return nav.map((point) => {
    const value = point.accumulated_nav ?? point.nav;
    peak = Math.max(peak, value);
    return {
      date: point.date,
      drawdown: peak ? value / peak - 1 : 0,
    };
  });
}

export function NormalizedReturnChart({
  series,
  height = 260,
}: {
  series: NamedNavSeries[];
  height?: number;
}) {
  const rows = buildNormalizedReturnRows(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 11 }} />
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
        <XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <Area dataKey="drawdown" fill="#dbeafe" name="回撤" stroke="#2563eb" type="monotone" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function YearlyReturnBarChart({ data, height = 240 }: { data: YearlyReturn[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <ReferenceLine stroke="#94a3b8" y={0} />
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
    size: Math.max(90, Math.abs(item.max_drawdown) * 900),
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

export function ContributionBarChart({
  items,
  height = 240,
}: {
  items: PortfolioContribution[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} type="number" />
        <YAxis dataKey="code" tick={{ fontSize: 11 }} type="category" width={76} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <ReferenceLine stroke="#94a3b8" x={0} />
        <Bar dataKey="contribution" name="收益贡献" radius={[0, 4, 4, 0]}>
          {items.map((item) => (
            <Cell fill={item.contribution >= 0 ? "#dc2626" : "#059669"} key={`${item.asset_type}-${item.code}`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
