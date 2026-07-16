"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { LoadHistoryPoint } from "@/lib/types";

// Cores do design system "Voltagem" (ver frontend/app/globals.css). Recharts
// precisa de valores de cor concretos — não referencia as CSS custom
// properties diretamente, então esses hex têm que ficar em sincronia manual
// com os tokens --volt-400 / --fog-500 / --border.
const ACCENT = "#FFC93C";
const MUTED = "#7C8797";
const GRID = "#262D3D";

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function LoadHistoryChart({ history }: { history: LoadHistoryPoint[] }) {
  const data = history.map((p) => ({ ...p, label: formatDateLabel(p.date) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
            width={36}
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
            formatter={(value) => [`${value}kg`, "Carga máxima"]}
          />
          <Line
            type="monotone"
            dataKey="maxWeightKg"
            stroke={ACCENT}
            strokeWidth={2}
            dot={{ r: 4, fill: ACCENT, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
