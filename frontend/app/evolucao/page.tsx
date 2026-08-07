"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listLoggedExercises, getLoadHistory, getFrequency, getSessionHistory } from "@/lib/api/progress";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { EffortDistributionBar } from "@/components/effort-distribution-bar";

// Perf (Grupo Y, item 103): `recharts` só é necessário quando o histórico
// realmente chegou (`loadHistoryQuery.data`/`frequencyQuery.data`) — carregar
// via `next/dynamic` tira a lib do bundle inicial desta rota.
const LoadHistoryChart = dynamic(
  () => import("@/components/load-history-chart").then((m) => m.LoadHistoryChart),
  { ssr: false }
);
const FrequencyChart = dynamic(
  () => import("@/components/frequency-chart").then((m) => m.FrequencyChart),
  { ssr: false }
);
// Fase 112: mesmo motivo de dynamic import acima.
const SessionTrendChart = dynamic(
  () => import("@/components/session-trend-chart").then((m) => m.SessionTrendChart),
  { ssr: false }
);

function PercentBadge({ value }: { value: number | null }) {
  const t = useTranslations("evolucao");
  if (value === null) {
    return <span className="text-sm text-muted">{t("noPreviousComparison")}</span>;
  }
  const isUp = value > 0;
  const isFlat = value === 0;
  const color = isFlat ? "text-muted" : isUp ? "text-success" : "text-danger";
  const arrow = isFlat ? "→" : isUp ? "▲" : "▼";
  return (
    <span className={`font-mono-nums text-sm font-semibold ${color}`}>
      {t("comparisonText", {
        arrow,
        sign: isUp && !isFlat ? "+" : "",
        value: value.toFixed(2),
      })}
    </span>
  );
}

function EvolucaoContent() {
  const t = useTranslations("evolucao");
  const tCommon = useTranslations("common");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");

  const exercisesQuery = useQuery({
    queryKey: ["progress-exercises"],
    queryFn: () => listLoggedExercises(),
  });

  const exercises = exercisesQuery.data?.exercises ?? [];
  // Sem estado derivado via effect: se nada foi escolhido manualmente ainda,
  // cai no primeiro exercício assim que a lista chega.
  const exerciseId = selectedExerciseId || exercises[0]?.id || "";

  const loadHistoryQuery = useQuery({
    queryKey: ["load-history", exerciseId],
    queryFn: () => getLoadHistory(exerciseId),
    enabled: !!exerciseId,
  });

  const frequencyQuery = useQuery({
    queryKey: ["frequency"],
    queryFn: () => getFrequency("6m"),
  });

  // Fase 112 (plano de captura de dados pro dashboard histórico): tendência
  // de duração real/carga de treino + distribuição de esforço — fundação
  // nova (WorkoutSessionLog), sem depender de wearable nenhum.
  const sessionHistoryQuery = useQuery({
    queryKey: ["session-history"],
    queryFn: () => getSessionHistory(),
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("maxLoadPerExercise")}
            </span>
          </div>

          {exercisesQuery.isLoading && <p className="text-sm text-muted">{t("loadingExercises")}</p>}

          {exercisesQuery.isError && (
            <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
          )}

          {exercisesQuery.isSuccess && exercises.length === 0 && (
            <p className="text-sm text-muted">{t("noSetsLoggedYet")}</p>
          )}

          {exercises.length > 0 && (
            <>
              <select
                value={exerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.muscleGroup})
                  </option>
                ))}
              </select>

              {loadHistoryQuery.isLoading && (
                <p className="text-sm text-muted">{t("loadingHistory")}</p>
              )}

              {loadHistoryQuery.isError && (
                <QueryError error={loadHistoryQuery.error} onRetry={() => loadHistoryQuery.refetch()} />
              )}

              {loadHistoryQuery.data && loadHistoryQuery.data.history.length === 0 && (
                <p className="text-sm text-muted">{t("noHistoryForExercise")}</p>
              )}

              {loadHistoryQuery.data && loadHistoryQuery.data.history.length > 0 && (
                <>
                  <PercentBadge value={loadHistoryQuery.data.percentChangeVsPrevious} />
                  <LoadHistoryChart history={loadHistoryQuery.data.history} />

                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer select-none">{t("viewAsTable")}</summary>
                    <table className="mt-2 w-full text-left font-mono-nums text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted">
                          <th className="py-1 pr-4 font-normal">{t("dateColumn")}</th>
                          <th className="py-1 font-normal">{t("maxLoadColumn")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadHistoryQuery.data.history.map((p) => (
                          <tr key={p.date} className="border-b border-border/50">
                            <td className="py-1 pr-4">{p.date}</td>
                            {/* I2 (auditoria 2026-08-06): unidade vem da
                                mensagem, não concatenada no JSX — convenção do
                                projeto (ex: `"{reps} reps × {weight}kg"`). */}
                            <td className="py-1">{t("maxLoadValue", { weight: p.maxWeightKg })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            {t("workoutFrequency")}
          </span>

          {frequencyQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

          {frequencyQuery.isError && (
            <QueryError error={frequencyQuery.error} onRetry={() => frequencyQuery.refetch()} />
          )}

          {frequencyQuery.data && (
            <>
              <p className="font-mono-nums text-sm text-muted">
                {t("workoutsInPeriod", { count: frequencyQuery.data.totalWorkouts })}
              </p>
              <FrequencyChart months={frequencyQuery.data.months} />
            </>
          )}
        </Card>

        {/* Fase 112: tendência de duração real + carga de treino (RPE ×
            duração) — 2 gráficos de 1 métrica cada, nunca um só com 2 eixos
            (escalas incompatíveis demais pra compartilhar eixo). */}
        <Card className="flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            {t("sessionTrendTitle")}
          </span>

          {sessionHistoryQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

          {sessionHistoryQuery.isError && (
            <QueryError error={sessionHistoryQuery.error} onRetry={() => sessionHistoryQuery.refetch()} />
          )}

          {sessionHistoryQuery.isSuccess && sessionHistoryQuery.data.sessions.length === 0 && (
            <p className="text-sm text-muted">{t("noSessionHistory")}</p>
          )}

          {sessionHistoryQuery.isSuccess && sessionHistoryQuery.data.sessions.length > 0 && (
            <>
              <p className="text-xs text-muted">{t("durationTrendLabel")}</p>
              <SessionTrendChart sessions={sessionHistoryQuery.data.sessions} metric="durationMinutes" />
              <p className="text-xs text-muted">{t("trainingLoadTrendLabel")}</p>
              {/* B2 (auditoria 2026-08-06): `trainingLoad` é null sempre que a
                  sessão não tem RPE (a pergunta pós-treino é opcional), então
                  um aluno que nunca respondeu via este rótulo sobre uma área
                  de plotagem VAZIA, sem linha e sem explicação. O
                  EffortDistributionBar já tratava esse caso; aqui faltava. */}
              {sessionHistoryQuery.data.sessions.some((s) => s.trainingLoad !== null) ? (
                <SessionTrendChart sessions={sessionHistoryQuery.data.sessions} metric="trainingLoad" />
              ) : (
                <p className="text-sm text-muted">{t("noTrainingLoadYet")}</p>
              )}
            </>
          )}
        </Card>

        {sessionHistoryQuery.isSuccess && sessionHistoryQuery.data.sessions.length > 0 && (
          <Card className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("effortDistributionTitle")}
            </span>
            <EffortDistributionBar distribution={sessionHistoryQuery.data.effortDistribution} />
          </Card>
        )}
      </main>
    </>
  );
}

export default function EvolucaoPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <EvolucaoContent />
    </AuthGuard>
  );
}
