"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { listLoggedExercises, getLoadHistory, getFrequency } from "@/lib/api/progress";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { LoadHistoryChart } from "@/components/load-history-chart";
import { FrequencyChart } from "@/components/frequency-chart";
import { DeleteProgramButton } from "@/components/delete-program-button";

/**
 * Fase 29 — hub de administração do aluno: o Personal cria um programa e
 * antes não tinha pra onde voltar pra ver o que já prescreveu, acompanhar
 * evolução ou acessar a anamnese, tudo num só lugar. Cada seção reaproveita
 * telas/endpoints já existentes (programas → /personal/programas/[id];
 * evolução → mesmos componentes de gráfico e endpoints de /evolucao, agora
 * também liberados pro Personal vinculado; anamnese → link pra tela já
 * existente desde a Fase 17) — nada duplicado.
 */
function AlunoHubContent() {
  const params = useParams<{ alunoId: string }>();
  const alunoId = params.alunoId;
  const queryClient = useQueryClient();

  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });
  const aluno = relationsQuery.data?.relations.find((r) => r.id === alunoId);

  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal", "aluno", alunoId],
    queryFn: () => listWorkoutPrograms(undefined, alunoId),
    enabled: !!aluno,
  });

  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const exercisesQuery = useQuery({
    queryKey: ["progress-exercises", alunoId],
    queryFn: () => listLoggedExercises(alunoId),
    enabled: !!aluno,
  });
  const exercises = exercisesQuery.data?.exercises ?? [];
  const exerciseId = selectedExerciseId || exercises[0]?.id || "";

  const loadHistoryQuery = useQuery({
    queryKey: ["load-history", alunoId, exerciseId],
    queryFn: () => getLoadHistory(exerciseId, alunoId),
    enabled: !!aluno && !!exerciseId,
  });

  const frequencyQuery = useQuery({
    queryKey: ["frequency", alunoId],
    queryFn: () => getFrequency("6m", alunoId),
    enabled: !!aluno,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {relationsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {relationsQuery.isError && (
          <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
        )}

        {relationsQuery.isSuccess && !aluno && (
          <Card>
            <p className="text-sm text-danger">
              Este aluno não está vinculado a você (ou o link está incorreto).
            </p>
          </Card>
        )}

        {aluno && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                Aluno
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{aluno.email}</h1>
              <p className="text-sm text-muted">
                Vinculado desde {new Date(aluno.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <Link
              href={`/personal/alunos/${alunoId}/anamnese`}
              className="text-sm font-semibold text-accent-secondary hover:underline"
            >
              Ver anamnese →
            </Link>

            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">Programas de treino</h2>
              {programsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
              {programsQuery.isError && (
                <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
              )}
              {programsQuery.isSuccess && programsQuery.data.programs.length === 0 && (
                <p className="text-sm text-muted">Nenhum programa aplicado a este aluno ainda.</p>
              )}
              <div className="flex flex-col gap-2">
                {programsQuery.data?.programs.map((p) => (
                  <Link key={p.id} href={`/personal/programas/${p.id}`}>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-accent">
                      <div>
                        <span className="font-semibold">{p.name}</span>
                        <p className="text-xs text-muted">{p.workouts?.length ?? 0} sessão(ões)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeleteProgramButton
                          programId={p.id}
                          isTemplate={false}
                          onDeleted={() =>
                            queryClient.invalidateQueries({
                              queryKey: ["workout-programs", "personal", "aluno", alunoId],
                            })
                          }
                        />
                        <span className="text-sm text-muted">Abrir →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-bold">Evolução</h2>

              {exercisesQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
              {exercisesQuery.isError && (
                <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
              )}
              {exercisesQuery.isSuccess && exercises.length === 0 && (
                <p className="text-sm text-muted">
                  Este aluno ainda não registrou nenhuma série de treino.
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
                    <LoadHistoryChart history={loadHistoryQuery.data.history} />
                  )}
                </>
              )}

              {frequencyQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
              {frequencyQuery.isError && (
                <QueryError error={frequencyQuery.error} onRetry={() => frequencyQuery.refetch()} />
              )}
              {frequencyQuery.data && (
                <>
                  <p className="font-mono-nums text-sm text-muted">
                    {frequencyQuery.data.totalWorkouts} treino(s) nos últimos 6 meses
                  </p>
                  <FrequencyChart months={frequencyQuery.data.months} />
                </>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function AlunoHubPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <AlunoHubContent />
    </AuthGuard>
  );
}
