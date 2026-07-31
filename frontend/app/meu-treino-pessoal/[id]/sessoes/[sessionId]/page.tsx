"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkoutProgram, addSelfProgramSession } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { labelFor, nextKeyInSequence, firstMissingKey } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { AddExerciseForm } from "@/components/add-exercise-form";
import { ExerciseReorderButtons } from "@/components/exercise-reorder-buttons";
import { ExerciseDeleteButton } from "@/components/exercise-delete-button";

/**
 * Fase 85 — versão simplificada, pro ALUNO, de
 * `/personal/programas/[id]/sessoes/[sessionId]` (edição de sessão do
 * Personal): mesmos componentes reaproveitados (`AddExerciseForm`,
 * `ExerciseReorderButtons`, `ExerciseDeleteButton` — todos já batem nos
 * endpoints genéricos `/api/workouts/:id/exercises...`, que o backend agora
 * também aceita pro dono ALUNO de um treino origin: SELF), só sem o link
 * "ver como o aluno vê" (não faz sentido pro próprio dono) e voltando pra
 * `/programas/[id]` (visão geral já usada por qualquer treino do aluno) em
 * vez de uma tela exclusiva do Personal.
 */
function SessaoContent() {
  const t = useTranslations("personalSessaoEditor");
  const tCommon = useTranslations("common");
  const params = useParams<{ id: string; sessionId: string }>();
  const router = useRouter();
  const programId = params.id;
  const sessionId = params.sessionId;
  const queryClient = useQueryClient();

  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
  });

  const addSessionMutation = useMutation({
    mutationFn: (letter: string) => addSelfProgramSession(programId, { letter }),
    onSuccess: (data) => {
      invalidateProgram();
      router.push(`/meu-treino-pessoal/${programId}/sessoes/${data.session.id}`);
    },
  });

  const program = programQuery.data?.program;
  const scheme = program?.sessionScheme ?? "LETTER";

  const { session, nextKey, nextSession, sessionExercises } = useMemo(() => {
    const session = program?.workouts?.find((w) => w.id === sessionId);
    // Checagem de consistência pós-auditoria (2026-07-31, F12): mesmo achado
    // já corrigido em `/programas/[id]` e na versão do Personal desta mesma
    // tela — `nextKeyInSequence` esconde o "Próximo" inteiro pra sessão que
    // está por último na ordem do esquema, mesmo com dias/letras livres mais
    // cedo na sequência. `firstMissingKey` só entra quando não há um próximo
    // posicional (preserva o caso comum sem mudança).
    const positionalNext = session ? nextKeyInSequence(scheme, session.letter) : null;
    const existingLetters = program?.workouts?.map((w) => w.letter) ?? [];
    const nextKey = session ? (positionalNext ?? firstMissingKey(scheme, existingLetters)) : null;
    const nextSession = nextKey ? program?.workouts?.find((w) => w.letter === nextKey) : undefined;
    const sessionExercises = [...(session?.exercises ?? [])].sort((a, b) => a.order - b.order);
    return { session, nextKey, nextSession, sessionExercises };
  }, [programQuery.data, sessionId, scheme]);

  const invalidateProgram = () => {
    queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });
    // Achado durante a triagem de perf (Grupo Y): o resumo agregado do
    // dashboard (Fase 96, GET /api/dashboard/aluno-summary) embute este
    // MESMO programa self em detalhe, sob uma chave de cache própria —
    // editar exercício aqui não refletia lá até essa chave ser invalidada
    // também.
    queryClient.invalidateQueries({ queryKey: ["aluno-dashboard-summary"] });
  };

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && !session && <p className="text-sm text-danger">{t("sessionNotFound")}</p>}

        {program && session && (
          <>
            <div>
              <Link
                href={`/programas/${programId}`}
                className="mb-2 inline-block text-xs font-semibold text-muted hover:text-foreground"
              >
                {t("backToProgram")}
              </Link>
              <span className="block text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {program.name}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {t("sessionTitle", { label: labelFor(scheme, session.letter) })}
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
                      <div className="flex-1">
                        <span className="font-mono-nums text-xs text-muted">#{ex.order}</span>{" "}
                        {ex.exercise?.name}{" "}
                        <span className="text-xs text-muted">
                          ({ex.sets}x {ex.repsRange})
                        </span>
                      </div>
                      <ExerciseDeleteButton
                        workoutId={session.id}
                        workoutExerciseId={ex.id}
                        onDeleted={invalidateProgram}
                      />
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

            {/* Fr10 (auditoria 2026-07-31): 2 botões `flex-1` sem `flex-wrap`
                — com o esquema "Dias da semana" ("Próximo: Segunda →") a
                linha pede mais largura do que cabe em qualquer celular até
                ~390px, e a página inteira passava a rolar na horizontal.
                `flex-wrap` empilha os 2 botões em telas estreitas. */}
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" className="flex-1">
                <Link href={`/programas/${programId}`}>{t("backToProgram")}</Link>
              </Button>
              {nextKey &&
                (nextSession ? (
                  <Button asChild className="flex-1">
                    <Link href={`/meu-treino-pessoal/${programId}/sessoes/${nextSession.id}`}>
                      {t("nextSession", { label: labelFor(scheme, nextKey) })}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    disabled={addSessionMutation.isPending}
                    onClick={() => addSessionMutation.mutate(nextKey)}
                  >
                    {addSessionMutation.isPending
                      ? t("creating")
                      : t("nextSession", { label: labelFor(scheme, nextKey) })}
                  </Button>
                ))}
            </div>
            {addSessionMutation.isError && (
              // Fr15 (auditoria 2026-07-31): mesmo achado de /programas/[id]
              // — texto genérico escondia a mensagem real do backend.
              <p className="text-sm text-danger">
                {addSessionMutation.error instanceof ApiError
                  ? addSessionMutation.error.message
                  : t("nextSessionError")}
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function SessaoPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <Suspense fallback={null}>
        <SessaoContent />
      </Suspense>
    </AuthGuard>
  );
}
