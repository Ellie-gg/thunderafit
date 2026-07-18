"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkoutProgram,
  addProgramSession,
  applyProgram,
} from "@/lib/api/workouts";
import { listRelations } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { AddExerciseForm } from "@/components/add-exercise-form";

const LETTERS = ["A", "B", "C", "D", "E"];

function ProgramaDetalheContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const programId = params.id;
  const queryClient = useQueryClient();

  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
  });
  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });

  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  // Fase 25: pré-preenche com o aluno-alvo escolhido na criação do programa
  // (query string ?alunoId=), quando houver — só um atalho, aplicar continua
  // sendo um clique explícito.
  const [applyAlunoId, setApplyAlunoId] = useState(searchParams.get("alunoId") ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });

  const addSessionMutation = useMutation({
    mutationFn: (letter: string) => addProgramSession(programId, { letter }),
    onSuccess: invalidate,
  });

  const applyMutation = useMutation({
    mutationFn: () => applyProgram(programId, applyAlunoId),
    onSuccess: () => {
      setApplyAlunoId("");
      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] });
    },
  });

  const program = programQuery.data?.program;
  const sessions = [...(program?.workouts ?? [])].sort((a, b) => a.letter.localeCompare(b.letter));
  const usedLetters = new Set(sessions.map((s) => s.letter));
  const availableLetters = LETTERS.filter((l) => !usedLetters.has(l));

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {program.isTemplate ? "Template" : "Aplicado a aluno"}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{program.name}</h1>
              <p className="text-sm text-muted">{sessions.length}/5 sessão(ões)</p>
            </div>

            {/* Sessões */}
            <section className="flex flex-col gap-3">
              {sessions.map((s) => (
                <Card key={s.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-display text-lg font-bold text-accent">{s.letter}</span>{" "}
                      <span className="font-semibold">{s.name}</span>
                      <p className="text-xs text-muted">
                        {s.exercises?.length ?? 0} exercício(s)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenSessionId(openSessionId === s.id ? null : s.id)}
                    >
                      {openSessionId === s.id ? "Fechar" : "Exercícios"}
                    </Button>
                  </div>
                  {openSessionId === s.id && (
                    <div className="border-t border-border pt-3">
                      {(s.exercises ?? []).length > 0 && (
                        <ul className="mb-3 flex flex-col gap-1">
                          {[...(s.exercises ?? [])]
                            .sort((a, b) => a.order - b.order)
                            .map((ex) => (
                              <li key={ex.id} className="text-sm">
                                <span className="font-mono-nums text-xs text-muted">#{ex.order}</span>{" "}
                                {ex.exercise?.name}{" "}
                                <span className="text-xs text-muted">
                                  ({ex.sets}x {ex.repsRange})
                                </span>
                              </li>
                            ))}
                        </ul>
                      )}
                      <AddExerciseForm
                        workoutId={s.id}
                        nextOrder={(s.exercises?.length ?? 0) + 1}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </section>

            {/* Adicionar sessão */}
            {availableLetters.length > 0 && (
              <Card className="flex flex-col gap-2">
                <Label>Adicionar sessão</Label>
                <div className="flex flex-wrap gap-2">
                  {availableLetters.map((l) => (
                    <Button
                      key={l}
                      variant="outline"
                      size="sm"
                      disabled={addSessionMutation.isPending}
                      onClick={() => addSessionMutation.mutate(l)}
                    >
                      + {l}
                    </Button>
                  ))}
                </div>
                {addSessionMutation.isError && (
                  <p className="text-sm text-danger">Erro ao adicionar sessão.</p>
                )}
              </Card>
            )}

            {/* Aplicar a aluno */}
            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">Aplicar a um aluno</h2>
              <p className="text-xs text-muted">
                Cria uma cópia independente deste programa para o aluno. Editar este
                programa depois não afeta cópias já aplicadas — e você pode aplicar
                este mesmo template a outros alunos vinculados quantas vezes quiser.
              </p>
              <select
                value={applyAlunoId}
                onChange={(e) => setApplyAlunoId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="" disabled>
                  Selecione um aluno
                </option>
                {relationsQuery.data?.relations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.email}
                  </option>
                ))}
              </select>
              {applyMutation.isError && (
                <p className="text-sm text-danger">
                  {applyMutation.error instanceof ApiError
                    ? applyMutation.error.message
                    : "Erro ao aplicar."}
                </p>
              )}
              {applyMutation.isSuccess && (
                <p className="text-sm text-success">Programa aplicado ao aluno.</p>
              )}
              <Button
                disabled={!applyAlunoId || applyMutation.isPending || sessions.length === 0}
                onClick={() => applyMutation.mutate()}
              >
                {applyMutation.isPending ? "Aplicando..." : "Aplicar programa"}
              </Button>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function ProgramaDetalhePage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL", "NUTRICIONISTA"]}>
      <Suspense fallback={null}>
        <ProgramaDetalheContent />
      </Suspense>
    </AuthGuard>
  );
}
