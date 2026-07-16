"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLoggedExercises, getLoadHistory, getFrequency } from "@/lib/api/progress";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { LoadHistoryChart } from "@/components/load-history-chart";
import { FrequencyChart } from "@/components/frequency-chart";
import { QueryError } from "@/components/query-error";

function PercentBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-sm text-muted">Sem comparação anterior ainda</span>;
  }
  const isUp = value > 0;
  const isFlat = value === 0;
  const color = isFlat ? "text-muted" : isUp ? "text-success" : "text-danger";
  const arrow = isFlat ? "→" : isUp ? "▲" : "▼";
  return (
    <span className={`font-mono-nums text-sm font-semibold ${color}`}>
      {arrow} {isUp && !isFlat ? "+" : ""}
      {value.toFixed(2)}% vs sessão anterior
    </span>
  );
}

function EvolucaoContent() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");

  const exercisesQuery = useQuery({
    queryKey: ["progress-exercises"],
    queryFn: listLoggedExercises,
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

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Evolução</h1>
          <p className="text-sm text-muted">Seu histórico de carga e frequência de treinos.</p>
        </div>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              Carga máxima por exercício
            </span>
          </div>

          {exercisesQuery.isLoading && <p className="text-sm text-muted">Carregando exercícios...</p>}

          {exercisesQuery.isError && (
            <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
          )}

          {exercisesQuery.isSuccess && exercises.length === 0 && (
            <p className="text-sm text-muted">
              Você ainda não registrou nenhuma série. Execute um treino primeiro para ver sua
              evolução aqui.
            </p>
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
                <p className="text-sm text-muted">Carregando histórico...</p>
              )}

              {loadHistoryQuery.isError && (
                <QueryError error={loadHistoryQuery.error} onRetry={() => loadHistoryQuery.refetch()} />
              )}

              {loadHistoryQuery.data && loadHistoryQuery.data.history.length === 0 && (
                <p className="text-sm text-muted">
                  Ainda não há séries registradas para este exercício.
                </p>
              )}

              {loadHistoryQuery.data && loadHistoryQuery.data.history.length > 0 && (
                <>
                  <PercentBadge value={loadHistoryQuery.data.percentChangeVsPrevious} />
                  <LoadHistoryChart history={loadHistoryQuery.data.history} />

                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer select-none">Ver como tabela</summary>
                    <table className="mt-2 w-full text-left font-mono-nums text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted">
                          <th className="py-1 pr-4 font-normal">Data</th>
                          <th className="py-1 font-normal">Carga máxima</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadHistoryQuery.data.history.map((p) => (
                          <tr key={p.date} className="border-b border-border/50">
                            <td className="py-1 pr-4">{p.date}</td>
                            <td className="py-1">{p.maxWeightKg}kg</td>
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
            Frequência de treinos (últimos 6 meses)
          </span>

          {frequencyQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

          {frequencyQuery.isError && (
            <QueryError error={frequencyQuery.error} onRetry={() => frequencyQuery.refetch()} />
          )}

          {frequencyQuery.data && (
            <>
              <p className="font-mono-nums text-sm text-muted">
                {frequencyQuery.data.totalWorkouts} treino(s) no período
              </p>
              <FrequencyChart months={frequencyQuery.data.months} />
            </>
          )}
        </Card>
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
