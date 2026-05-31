import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { NavPoint } from "../types";

type NavChartProps = {
  data: NavPoint[];
  height?: number;
};

export function NavChart({ data, height = 280 }: NavChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf2" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} domain={["dataMin", "dataMax"]} />
        <Tooltip formatter={(value) => Number(value).toFixed(4)} />
        <Line type="monotone" dataKey="nav" stroke="#2563eb" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
