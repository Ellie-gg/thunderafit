import * as React from "react";
import type { WorkoutCompletionSummary } from "@/lib/types";
import { BoltMark } from "@/components/bolt-mark";
import { PrBadgePill, PrOverflowPill } from "@/components/pr-badge-pill";

// Fase 35: card de resumo pós-treino — uma peça só, dois usos: recapitulação
// motivacional dentro do app E imagem exportável (proporção 9:16, Stories do
// Instagram). Sempre renderiza no aspect-ratio 9:16 inteiro; é o MESMO DOM
// que é capturado na exportação (via html-to-image, upscaled por pixelRatio),
// não existe um modo "compacto" separado — só a moldura ao redor (modal)
// muda entre os dois usos, o card em si nunca muda.
//
// Padding interno generoso no topo/rodapé pra respeitar as zonas seguras do
// Instagram Stories (a própria UI do app deles sobrepõe o topo ~120-250px e
// o rodapé ~180-250px a 1080×1920) — mantém os números principais no terço
// central, longe de onde a UI deles cobriria.
export const PostWorkoutSummaryCard = React.forwardRef<HTMLDivElement, { summary: WorkoutCompletionSummary }>(
  function PostWorkoutSummaryCard({ summary }, ref) {
    const { comparison, personalRecords } = summary;
    const visiblePRs = personalRecords.slice(0, 2);
    const overflowCount = personalRecords.length - visiblePRs.length;

    return (
      <div
        ref={ref}
        className="relative flex aspect-[9/16] w-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface px-6 pb-[10%] pt-[8%]"
      >
        <header>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            Treino {summary.workoutLetter}
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {summary.workoutName}
          </h2>
        </header>

        <section className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted">Volume total</p>
          <p className="font-mono-nums font-display text-5xl font-bold text-accent-secondary">
            {summary.volumeKg.toLocaleString("pt-BR")}{" "}
            <span className="text-lg font-normal text-muted">kg</span>
          </p>

          {comparison.type === "PERCENT" ? (
            <p className={comparison.percentChange! >= 0 ? "text-accent-secondary" : "text-muted"}>
              {comparison.percentChange! >= 0 ? "▲" : "▼"} {Math.abs(comparison.percentChange!)}% vs.
              treino anterior
            </p>
          ) : (
            <p className="text-accent-secondary">
              Primeiro treino de {summary.workoutName} registrado 💪
            </p>
          )}

          <p className="text-sm text-muted">{summary.setsLogged} séries registradas</p>
        </section>

        {personalRecords.length > 0 && (
          <section className="flex flex-wrap gap-2">
            {visiblePRs.map((pr) => (
              <PrBadgePill key={pr.exerciseId} pr={pr} />
            ))}
            {overflowCount > 0 && <PrOverflowPill count={overflowCount} />}
          </section>
        )}

        <footer className="flex items-center gap-1.5 opacity-70">
          <BoltMark className="h-4 w-4" />
          <span className="font-display text-xs">ThunderaFit</span>
        </footer>
      </div>
    );
  }
);
