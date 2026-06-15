"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/connectors/types";

// DORA metriği için trend grafiği (Recharts AreaChart).
// "use client" — Recharts yalnızca client tarafında render edilir.

const COLORS: Record<string, string> = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  slate: "#475569",
};

export function TrendChart({
  data,
  color = "slate",
  unit,
}: {
  data: TrendPoint[];
  color?: keyof typeof COLORS;
  unit?: string;
}) {
  const stroke = COLORS[color] ?? COLORS.slate;
  const gradientId = `grad-${color}`;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={24}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          width={28}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [`${value}${unit ? ` ${unit}` : ""}`, ""]}
          labelFormatter={(label: string) => label}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
