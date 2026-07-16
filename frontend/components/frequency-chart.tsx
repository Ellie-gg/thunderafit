"use client";

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { FrequencyMonth } from "@/lib/types";

const ACCENT = "#FFC93C";
const MUTED = "#7C8797";
const GRID = "#262D3D";

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatMonthLabel(monthKey: string): string {
  const [, month] = monthKey.split("-");
  return MONTH_LABELS[Number(month) - 1];
}

export function FrequencyChart({ months }: { months: FrequencyMonth[] }) {
  const data = months.map((m) => ({ ...m, label: formatMonthLabel(m.month) }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={MUTED}
            tick={{ fill: MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            stroke={MUTED}
            tick={{ fill: MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#161B26",
              border: "1px solid #262D3D",
              borderRadius: 8,
              fontSize: 13,
            }}
            labelStyle={{ color: "#EEF1F6" }}
            itemStyle={{ color: ACCENT }}
            formatter={(value) => [`${value}`, "Treinos"]}
          />
          <Bar dataKey="workoutCount" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
