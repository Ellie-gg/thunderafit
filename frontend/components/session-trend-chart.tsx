"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { SessionHistoryPoint } from "@/lib/types";

// Mesmas cores do design system "Voltagem" já usadas em
// load-history-chart.tsx/frequency-chart.tsx — mantidas em sincronia manual
// com os tokens --volt-400/--fog-500/--border (recharts não lê CSS custom
// properties direto).
const ACCENT = "#FFC93C";
const MUTED = "#7C8797";
const GRID = "#262D3D";

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// Fase 112 (plano de captura de dados, crítica de design): 1 métrica por
// gráfico, NUNCA 2 eixos Y — duração e carga de treino têm escalas
// diferentes demais pra compartilhar um eixo sem distorcer a leitura.
// Reaproveita o padrão de `LoadHistoryChart` (1 série, mesmo componente),
// parametrizado pela métrica em vez de duplicar o arquivo inteiro.
export function SessionTrendChart({
  sessions,
  metric,
}: {
  sessions: SessionHistoryPoint[];
  metric: "durationMinutes" | "trainingLoad";
}) {
  const t = useTranslations("sessionTrendChart");
  const data = sessions.map((s) => ({ ...s, label: formatDateLabel(s.date) }));
  const tooltipLabel = metric === "durationMinutes" ? t("durationTooltip") : t("trainingLoadTooltip");
  const unit = metric === "durationMinutes" ? t("durationUnit") : "";

  return (
    <div className="h-56 w-full">
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
            formatter={(value) => [value === null ? t("noAnswer") : `${value}${unit}`, tooltipLabel]}
          />
          {/* connectNulls=false (default): sessões sem RPE respondido (carga
              de treino null) aparecem como um vão real no gráfico, não uma
              linha interpolada inventando um valor entre dois pontos reais. */}
          <Line
            type="monotone"
            dataKey={metric}
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
