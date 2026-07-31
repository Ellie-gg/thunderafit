"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkoutProgram, addProgramSession, renameWorkoutSession } from "@/lib/api/workouts";
import { labelFor, nextKeyInSequence, firstMissingKey } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { AddExerciseForm } from "@/components/add-exercise-form";
import { ExerciseReorderButtons } from "@/components/exercise-reorder-buttons";
import { ExerciseDeleteButton } from "@/components/exercise-delete-button";
import { InlineRename } from "@/components/inline-rename";

/**
 * Fase 26: tela própria por sessão — substitui o acordeão inline que existia
 * na visão geral do programa. "Próximo" cria (se ainda não existir) e abre a
 * próxima sessão da sequência do esquema; "Voltar ao programa" sai a
 * qualquer momento (o Personal decide quantas sessões quer preencher).
 */
function SessaoContent() {
  const t = useTranslations("personalSessaoEditor");
  const tCommon = useTranslations("common");
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
      // Fr19 (auditoria 2026-07-31): mesma correção da tela de detalhe do
      // programa — a lista de templates mostra contagem de sessões.
      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] });
      router.push(`/personal/programas/${programId}/sessoes/${data.session.id}${query}`);
    },
  });

  const renameSessionMutation = useMutation({
    mutationFn: (name: string) => renameWorkoutSession(sessionId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });
    },
  });

  const program = programQuery.data?.program;
  const scheme = program?.sessionScheme ?? "LETTER";

  const { session, nextKey, nextSession, sessionExercises } = useMemo(() => {
    const session = program?.workouts?.find((w) => w.id === sessionId);
    // Checagem de consistência pós-auditoria (2026-07-31, F12): `nextKeyInSequence`
    // devolve null pra sessão que está por ÚLTIMO na ordem do esquema — num
    // WEEKDAY com só SEGUNDA+DOMINGO criados, abrir DOMINGO escondia o botão
    // "Próximo" inteiro mesmo com TERÇA-SÁBADO ainda livres. `firstMissingKey`
    // (já usado em `/programas/[id]` pro mesmo achado) cobre essa lacuna sem
    // mudar o caso comum: só entra quando não há um próximo posicional.
    const positionalNext = session ? nextKeyInSequence(scheme, session.letter) : null;
    const existingLetters = program?.workouts?.map((w) => w.letter) ?? [];
    const nextKey = session ? (positionalNext ?? firstMissingKey(scheme, existingLetters)) : null;
    const nextSession = nextKey ? program?.workouts?.find((w) => w.letter === nextKey) : undefined;
    const sessionExercises = [...(session?.exercises ?? [])].sort((a, b) => a.order - b.order);
    return { session, nextKey, nextSession, sessionExercises };
  }, [programQuery.data, sessionId, scheme]);

  const invalidateProgram = () =>
    queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && !session && (
          <p className="text-sm text-danger">{t("sessionNotFound")}</p>
        )}

        {program && session && (
          <>
            <div>
              <Link
                href={`/personal/programas/${programId}${query}`}
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
              <InlineRename
                value={session.name}
                onSave={(name) => renameSessionMutation.mutateAsync(name)}
                ariaLabel={t("renameSessionAriaLabel")}
                textClassName="text-sm font-semibold text-foreground"
              />
              {/* Fase 65: preview somente-leitura no mesmo layout visual do
                  aluno — antes o Personal só via a lista de edição crua. */}
              <Link
                href={`/personal/programas/${programId}/sessoes/${sessionId}/visualizar${query}`}
                className="mt-1 inline-block text-sm font-semibold text-accent-secondary hover:underline"
              >
                {t("viewAsStudent")}
              </Link>
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
                        {ex.notes && (
                          <p className="text-xs text-muted">{t("notes", { notes: ex.notes })}</p>
                        )}
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

            {/* Fr10 (auditoria 2026-07-31): mesmo achado da tela irmã do
                aluno — sem `flex-wrap`, o esquema "Dias da semana" estourava
                a largura em qualquer celular até ~390px. */}
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" className="flex-1">
                <Link href={`/personal/programas/${programId}${query}`}>{t("backToProgram")}</Link>
              </Button>
              {nextKey &&
                (nextSession ? (
                  <Button asChild className="flex-1">
                    <Link href={`/personal/programas/${programId}/sessoes/${nextSession.id}${query}`}>
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
              <p className="text-sm text-danger">{t("nextSessionError")}</p>
            )}
          </>
        )}
      </main>
    </>
  );
}

// Checagem de consistência pós-auditoria (2026-07-31, X1): as telas irmãs
// (`/personal/programas` e `/personal/programas/[id]`) já restringiram a
// PERSONAL quando o backend fechou a brecha de NUTRICIONISTA prescrevendo
// treino — esta ficou de fora. Não é brecha de segurança (o backend já
// rejeita com 403), só deixava um Nutricionista cair aqui vindo de um link
// direto e levar um erro cru em vez de nunca ver a tela.
export default function SessaoPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <Suspense fallback={null}>
        <SessaoContent />
      </Suspense>
    </AuthGuard>
  );
}
