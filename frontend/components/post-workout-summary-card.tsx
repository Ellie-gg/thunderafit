import * as React from "react";
import type { WorkoutCompletionSummary } from "@/lib/types";
import { BoltMark } from "@/components/bolt-mark";
import { PrBadgePill, PrOverflowPill } from "@/components/pr-badge-pill";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { useTranslations } from "next-intl";

// Fase 39: formato Horas:Min:Segundos pedido explicitamente — sempre com a
// hora (mesmo "0:12:34"), não só MM:SS, pra treinos que passam de 1h também
// ficarem corretos sem mudar de formato no meio.
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Fase 35/37/39: card de resumo pós-treino — uma peça só, dois usos: recapitulação
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
export const PostWorkoutSummaryCard = React.forwardRef<
  HTMLDivElement,
  { summary: WorkoutCompletionSummary; alunoName: string; durationSeconds: number | null }
>(function PostWorkoutSummaryCard({ summary, alunoName, durationSeconds }, ref) {
  const intlLocale = useActiveIntlLocale();
  const t = useTranslations("postWorkoutSummaryCard");
  const { hasHistory, volumeChangePercent, personalRecords } = summary;
  const visiblePRs = personalRecords.slice(0, 2);
  const overflowCount = personalRecords.length - visiblePRs.length;

  return (
    <div
      ref={ref}
      className="relative flex aspect-[9/16] w-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface px-6 pb-[10%] pt-[8%]"
    >
      <header>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          {t("workoutHeader", { workoutLetter: summary.workoutLetter, workoutName: summary.workoutName })}
        </span>
        {/* Fase 39: header personalizado — substitui o antigo "Treino A"
            como texto principal. Cai pro prefixo do e-mail quando o aluno
            não tem nome cadastrado (ver firstNameOrEmailPrefix). */}
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          {t("greeting", { alunoName })}
        </h2>
      </header>

      {/* Fase 37: hero passa a ser a contagem de séries (o "quanto trabalho
          de verdade" mais direto de comunicar), não mais o volume — volume
          desce pra métrica secundária, relabelado "Peso levantado Hoje". */}
      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted">{t("setsLoggedLabel")}</p>
        <p className="font-mono-nums font-display text-6xl font-bold text-accent-secondary">
          {summary.setsLogged}
        </p>

        <div className="grid grid-cols-3 gap-2">
          <SecondaryMetric
            label={t("durationLabel")}
            value={durationSeconds !== null ? formatDuration(durationSeconds) : "—"}
          />
          <SecondaryMetric label={t("volumeLabel")} value={`${summary.volumeKg.toLocaleString(intlLocale)} kg`} />
          <SecondaryMetric label={t("streakLabel")} value={`${summary.streakDays}`} accent="accent" />
        </div>

        {hasHistory ? (
          <p className={volumeChangePercent! >= 0 ? "text-accent-secondary" : "text-muted"}>
            {t("volumeComparison", {
              arrow: volumeChangePercent! >= 0 ? "▲" : "▼",
              percent: Math.abs(volumeChangePercent!),
            })}
          </p>
        ) : (
          <p className="text-accent-secondary">
            {t("firstWorkout", { workoutName: summary.workoutName })}
          </p>
        )}
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
});

function SecondaryMetric({
  label,
  value,
  accent = "accent-secondary",
}: {
  label: string;
  value: string;
  accent?: "accent" | "accent-secondary";
}) {
  const accentClass = accent === "accent" ? "text-accent" : "text-accent-secondary";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`font-mono-nums text-sm font-bold ${accentClass}`}>{value}</span>
    </div>
  );
}
