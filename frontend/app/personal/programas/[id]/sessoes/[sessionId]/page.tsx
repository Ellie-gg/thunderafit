"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkoutProgram, addProgramSession } from "@/lib/api/workouts";
import { labelFor, nextKeyInSequence } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { AddExerciseForm } from "@/components/add-exercise-form";
import { ExerciseReorderButtons } from "@/components/exercise-reorder-buttons";

/**
 * Fase 26: tela própria por sessão — substitui o acordeão inline que existia
 * na visão geral do programa. "Próximo" cria (se ainda não existir) e abre a
 * próxima sessão da sequência do esquema; "Voltar ao programa" sai a
 * qualquer momento (o Personal decide quantas sessões quer preencher).
 */
function SessaoContent() {
  const params = useParams<{ id: string; sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const programId = params.id;
  const sessionId = params.sessionId;
  const queryClient = useQueryClient();

  const alunoIdParam = searchParams.get("alunoId") ?? "";
  const query = alunoIdParam ? `?alunoId=${alunoIdParam}` : "";

  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
  });

  const addSessionMutation = useMutation({
    mutationFn: (letter: string) => addProgramSession(programId, { letter }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });
      router.push(`/personal/programas/${programId}/sessoes/${data.session.id}${query}`);
    },
  });

  const program = programQuery.data?.program;
  const scheme = program?.sessionScheme ?? "LETTER";
  const session = program?.workouts?.find((w) => w.id === sessionId);
  const nextKey = session ? nextKeyInSequence(scheme, session.letter) : null;
  const nextSession = nextKey ? program?.workouts?.find((w) => w.letter === nextKey) : undefined;
  const sessionExercises = [...(session?.exercises ?? [])].sort((a, b) => a.order - b.order);
  const invalidateProgram = () =>
    queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && !session && (
          <p className="text-sm text-danger">Sessão não encontrada neste programa.</p>
        )}

        {program && session && (
          <>
            <div>
              <Link
                href={`/personal/programas/${programId}${query}`}
                className="mb-2 inline-block text-xs font-semibold text-muted hover:text-foreground"
              >
                ← Voltar ao programa
              </Link>
              <span className="block text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {program.name}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Sessão {labelFor(scheme, session.letter)}
              </h1>
            </div>

            <Card className="flex flex-col gap-3">
              {sessionExercises.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {sessionExercises.map((ex, i) => (
                    <li key={ex.id} className="flex items-start gap-3 text-sm">
                      <ExerciseReorderButtons
                        workoutId={session.id}
                        workoutExerciseId={ex.id}
                        disabledUp={i === 0}
                        disabledDown={i === sessionExercises.length - 1}
                        onMoved={invalidateProgram}
                      />
                      <div>
                        <span className="font-mono-nums text-xs text-muted">#{ex.order}</span>{" "}
                        {ex.exercise?.name}{" "}
                        <span className="text-xs text-muted">
                          ({ex.sets}x {ex.repsRange})
                        </span>
                        {ex.notes && <p className="text-xs text-muted">Obs: {ex.notes}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <AddExerciseForm
                workoutId={session.id}
                nextOrder={sessionExercises.length + 1}
                onAdded={invalidateProgram}
              />
            </Card>

            <div className="flex gap-3">
              <Button asChild variant="secondary" className="flex-1">
                <Link href={`/personal/programas/${programId}${query}`}>← Voltar ao programa</Link>
              </Button>
              {nextKey &&
                (nextSession ? (
                  <Button asChild className="flex-1">
                    <Link href={`/personal/programas/${programId}/sessoes/${nextSession.id}${query}`}>
                      Próximo: {labelFor(scheme, nextKey)} →
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    disabled={addSessionMutation.isPending}
                    onClick={() => addSessionMutation.mutate(nextKey)}
                  >
                    {addSessionMutation.isPending
                      ? "Criando..."
                      : `Próximo: ${labelFor(scheme, nextKey)} →`}
                  </Button>
                ))}
            </div>
            {addSessionMutation.isError && (
              <p className="text-sm text-danger">Erro ao criar a próxima sessão.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function SessaoPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL", "NUTRICIONISTA"]}>
      <Suspense fallback={null}>
        <SessaoContent />
      </Suspense>
    </AuthGuard>
  );
}
