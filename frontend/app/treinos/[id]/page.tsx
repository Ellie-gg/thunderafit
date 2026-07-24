"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkout, completeWorkout } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { firstNameOrEmailPrefix, splitSetLogsBySessionBoundary } from "@/lib/utils";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { ExerciseExecutionCard } from "@/components/exercise-execution-card";
import { PostWorkoutSummaryModal } from "@/components/post-workout-summary-modal";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import type { WorkoutCompletionSummary } from "@/lib/types";

function ExecucaoContent() {
  const t = useTranslations("execucaoTreino");
  const intlLocale = useActiveIntlLocale();
  const params = useParams<{ id: string }>();
  const workoutId = params.id;
  const user = useAuthStore((s) => s.user);

  const queryClient = useQueryClient();
  const [summary, setSummary] = useState<WorkoutCompletionSummary | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  // Fase 39: cronômetro real da sessão — marca o momento em que a tela de
  // execução abriu; a duração exibida no card é (agora do clique em
  // "Concluir" − este timestamp). Puramente client-side, sem migration:
  // substitui a aproximação anterior (primeira a última série logada), que
  // não contava o aquecimento antes do primeiro registro. Limitação aceita:
  // se o aluno deixar a aba aberta em segundo plano por muito tempo antes de
  // concluir, a duração infla (não há pausa/retomada) — trade-off razoável
  // frente à aproximação anterior, que também não era exata.
  const [sessionStartedAt] = useState(() => Date.now());

  const workoutQuery = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => getWorkout(workoutId),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeWorkout(workoutId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workout", workoutId] });
      // A sugestão de próxima sessão no programa depende do lastCompletedAt.
      queryClient.invalidateQueries({ queryKey: ["workout-program"] });
      setDurationSeconds(Math.round((Date.now() - sessionStartedAt) / 1000));
      setSummary(data.summary);
    },
  });

  if (workoutQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">{t("loadingWorkout")}</span>
      </main>
    );
  }

  if (workoutQuery.isError) {
    const message =
      workoutQuery.error instanceof ApiError
        ? workoutQuery.error.message
        : t("loadError");
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <Card>
          <p className="text-sm text-danger">{message}</p>
        </Card>
      </main>
    );
  }

  if (!workoutQuery.data) return null;

  const workout = workoutQuery.data.workout;
  const exercises = workout.exercises ?? [];
  // Fase 40: mesmo bug corrigido no ExerciseExecutionCard — `setLogs` traz o
  // histórico inteiro (o Workout é reaberto toda semana), então o total do
  // cabeçalho também precisa contar só as séries DESTA sessão, senão volta a
  // mostrar "completo" pra sempre depois da 1ª semana.
  const sessionBoundary = workout.lastCompletedAt;
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const doneSets = exercises.reduce(
    (acc, ex) =>
      acc + splitSetLogsBySessionBoundary(ex.setLogs ?? [], sessionBoundary).thisSession.length,
    0
  );
  const allSetsDone = totalSets > 0 && doneSets >= totalSets;

  // Fase 33.1: ordem estável usada tanto pra renderizar quanto pra saber
  // qual card vem "abaixo" de cada exercício, pro auto-scroll ao marcar
  // "Concluído". O último exercício rola até o card "Concluir sessão" — fim
  // natural do fluxo, em vez de não fazer nada.
  const sortedExercises = [...exercises].sort((a, b) => a.order - b.order);
  const exerciseCardId = (exerciseId: string) => `exercise-card-${exerciseId}`;
  const COMPLETE_SESSION_CARD_ID = "complete-session-card";

  function scrollToNext(index: number) {
    const nextId =
      index + 1 < sortedExercises.length
        ? exerciseCardId(sortedExercises[index + 1].id)
        : COMPLETE_SESSION_CARD_ID;
    document.getElementById(nextId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          {t("workoutLabel", { letter: workout.letter })}
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{workout.name}</h1>
        <div className="mt-2 flex items-center gap-3">
          <VoltageBar total={totalSets} filled={doneSets} role="ALUNO" className="max-w-xs" />
          <span className="font-mono-nums text-xs text-muted">
            {doneSets}/{totalSets}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {sortedExercises.map((ex, index) => (
          <ExerciseExecutionCard
            key={ex.id}
            workoutId={workoutId}
            workoutExercise={ex}
            sessionBoundary={sessionBoundary}
            id={exerciseCardId(ex.id)}
            onMarkDone={(done) => {
              if (done) scrollToNext(index);
            }}
          />
        ))}
      </div>

      {/* Concluir sessão: disponível a qualquer momento (não exige todas as
          séries registradas — sem ordem/obrigação forçada, decisão da Fase 16),
          mas destacamos quando todas as séries já foram feitas. */}
      <Card id={COMPLETE_SESSION_CARD_ID} className="flex flex-col gap-2">
        {workout.lastCompletedAt && (
          <p className="text-xs text-muted">
            {t("lastCompleted", { date: new Date(workout.lastCompletedAt).toLocaleString(intlLocale) })}
          </p>
        )}
        <Button
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          variant={allSetsDone ? "default" : "secondary"}
        >
          {completeMutation.isPending
            ? t("completing")
            : completeMutation.isSuccess
              ? t("sessionCompleted")
              : t("completeSession")}
        </Button>
        {completeMutation.isError && (
          <p className="text-sm text-danger">{t("completeError")}</p>
        )}
      </Card>

      {summary && (
        <PostWorkoutSummaryModal
          summary={summary}
          alunoName={firstNameOrEmailPrefix(user)}
          durationSeconds={durationSeconds}
          // Fase 34.5: CTA de upsell só pra treinos "Meu treino pessoal"
          // (origin: SELF) — não existe plano pago pro aluno hoje, então o
          // CTA só oferece convidar um Personal (nada de "assinar PRO", que
          // seria um botão morto sem produto nenhum por trás).
          upsell={
            workout.program?.origin === "SELF" ? (
              <p className="text-center text-sm text-foreground">
                {t("upsellQuestion")}{" "}
                <Link href="/profissionais" className="font-semibold text-accent-secondary hover:underline">
                  {t("upsellLinkText")}
                </Link>{" "}
                {t("upsellSuffix")}
              </p>
            ) : null
          }
          onClose={() => setSummary(null)}
        />
      )}
    </main>
  );
}

export default function ExecucaoPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <AppHeader />
      <ExecucaoContent />
    </AuthGuard>
  );
}
