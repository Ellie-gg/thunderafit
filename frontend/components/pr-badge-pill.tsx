import type { WorkoutSummaryPR } from "@/lib/types";

/**
 * Fase 35: selo de recorde pessoal do card pós-treino — mesmo padrão visual
 * de pílula de `availability-badge.tsx` (borda/fundo via `color-mix` sobre
 * `--accent`), mas em dourado (semântica de "energia/conquista"), não ciano
 * (reservado a "dado positivo" — o volume já usa essa cor no card).
 */
export function PrBadgePill({ pr }: { pr: WorkoutSummaryPR }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        color: "var(--accent)",
      }}
    >
      <span aria-hidden>🏆</span>
      {pr.exerciseName} {pr.weightKg}kg
    </span>
  );
}

export function PrOverflowPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted">
      +{count} recorde{count > 1 ? "s" : ""}
    </span>
  );
}
