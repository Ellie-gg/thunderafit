import { cn } from "@/lib/utils";
import type { WeeklySummaryDay } from "@/lib/types";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function isSameUtcDay(dateKey: string, date: Date): boolean {
  return dateKey === date.toISOString().slice(0, 10);
}

/**
 * Fase 33.4: extensão do `VoltageBar` (assinatura visual do app) pra
 * frequência em vez de séries — 7 blocos, um por dia dos últimos 7,
 * acesos nos dias com pelo menos 1 série registrada. O dia atual sempre
 * ganha contorno tracejado (aceso ou não), pra sempre ser identificável
 * dentro da semana.
 *
 * Diferente do `VoltageBar` genérico (total/filled sequencial), aqui cada
 * segmento representa um dia ESPECÍFICO — por isso é um componente à parte
 * em vez de reaproveitar a mesma prop `filled` (que só preenche os N
 * primeiros segmentos em sequência, não um padrão arbitrário de dias).
 */
export function WeeklyVoltageBar({ days, className }: { days: WeeklySummaryDay[]; className?: string }) {
  const today = new Date();
  return (
    <div className={cn("voltage-bar voltage-bar--weekly", className)} role="img" aria-label="Frequência dos últimos 7 dias">
      {days.map((day) => {
        const dateObj = new Date(`${day.date}T00:00:00Z`);
        const weekdayLabel = WEEKDAY_LABELS[dateObj.getUTCDay()];
        const isToday = isSameUtcDay(day.date, today);
        return (
          <div
            key={day.date}
            className="voltage-segment"
            data-filled={day.active}
            data-today={isToday}
            title={`${day.date}${isToday ? " (hoje)" : ""}${day.active ? " — treino registrado" : ""}`}
            aria-label={weekdayLabel}
          />
        );
      })}
    </div>
  );
}
