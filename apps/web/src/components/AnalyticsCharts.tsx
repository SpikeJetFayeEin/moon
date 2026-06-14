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
import type { DrawdownPoint, FundManagerProductComparisonItem, NavPoint } from "../types";

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

export function buildDrawdownComparisonRows(series: NamedNavSeries[]) {
  const dates = new Map<string, Record<string, number | string>>();
  for (const item of series) {
    for (const point of buildDrawdownRows(item.nav)) {
      const row = dates.get(point.date) ?? { date: point.date };
      row[item.name] = point.drawdown;
      dates.set(point.date, row);
    }
  }
  return Array.from(dates.values()).sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
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

export function DrawdownComparisonChart({
  series,
  height = 240,
}: {
  series: NamedNavSeries[];
  height?: number;
}) {
  const rows = buildDrawdownComparisonRows(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 11 }} />
        <YAxis domain={["dataMin", 0]} tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(Number(value))} />
        <Tooltip formatter={(value) => formatPercent(Number(value))} />
        <ReferenceLine stroke="#94a3b8" y={0} />
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

export function ProductRiskReturnScatter({
  items,
  height = 300,
}: {
  items: FundManagerProductComparisonItem[];
  height?: number;
}) {
  const rows = items
    .filter(
      (item) =>
        item.status === "ready" &&
        item.return_rate != null &&
        item.volatility != null &&
        item.max_drawdown != null,
    )
    .map((item) => ({
      code: item.code,
      name: item.name,
      returnRate: item.return_rate ?? 0,
      volatility: item.volatility ?? 0,
      maxDrawdown: item.max_drawdown ?? 0,
      size: Math.max(item.asset_size_billion ?? 1, 1),
    }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7edf5" />
        <XAxis
          dataKey="volatility"
          name="年化波动"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatPercent(Number(value))}
          type="number"
        />
        <YAxis
          dataKey="returnRate"
          name="区间收益"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatPercent(Number(value))}
          type="number"
        />
        <ZAxis dataKey="size" range={[80, 520]} />
        <ReferenceLine stroke="#94a3b8" y={0} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value, name) => {
            if (name === "size") return [`${formatNumber(Number(value), 2)} 亿`, "规模"];
            return [formatPercent(Number(value)), name === "returnRate" ? "区间收益" : "年化波动"];
          }}
          labelFormatter={(_label: unknown, payload: any[]) => payload?.[0]?.payload?.name ?? ""}
        />
        <Scatter data={rows} fill="#2563eb" name="在管产品">
          {rows.map((row) => (
            <Cell
              fill={row.maxDrawdown < -0.12 ? "#dc2626" : row.returnRate >= 0 ? "#2563eb" : "#059669"}
              key={row.code}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
