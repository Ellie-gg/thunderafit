"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkout, completeWorkout } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { firstNameOrEmailPrefix, formatDuration, splitSetLogsBySessionBoundary } from "@/lib/utils";
import {
  IDLE_AUTO_FINISH_MS,
  clearWorkoutSession,
  loadWorkoutSession,
  saveWorkoutSession,
  workoutSessionPhase,
  type WorkoutSessionState,
} from "@/lib/workout-session-timer";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { ExerciseExecutionCard } from "@/components/exercise-execution-card";
import { PostWorkoutSummaryModal } from "@/components/post-workout-summary-modal";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import type { WorkoutCompletionSummary } from "@/lib/types";

function IdleWarningModal({
  remainingMs,
  onContinue,
  onFinishNow,
}: {
  remainingMs: number;
  onContinue: () => void;
  onFinishNow: () => void;
}) {
  const t = useTranslations("execucaoTreino");
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="flex w-full max-w-xs flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{t("idleWarningTitle")}</h2>
          <p className="text-sm text-muted">{t("idleWarningBody")}</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-md border border-border py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("idleWarningCountdownLabel")}
          </span>
          <span className="font-mono-nums text-2xl font-bold text-danger">
            {formatDuration(remainingSeconds)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={onContinue}>{t("continueWorkout")}</Button>
          <Button onClick={onFinishNow} variant="secondary">
            {t("completeSession")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ExecucaoContent() {
  const t = useTranslations("execucaoTreino");
  const intlLocale = useActiveIntlLocale();
  const params = useParams<{ id: string }>();
  const workoutId = params.id;
  const user = useAuthStore((s) => s.user);

  const queryClient = useQueryClient();
  const [summary, setSummary] = useState<WorkoutCompletionSummary | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  // Fase 89: cronômetro real com início explícito ("Iniciar Treino"),
  // persistido em localStorage por treino (sobrevive a refresh/fechar aba) —
  // substitui o início implícito da Fase 39 (que marcava o timestamp já na
  // abertura da tela, mesmo que o aluno só ficasse olhando os exercícios
  // antes de começar de verdade). Ver workout-session-timer.ts pro guard-rail
  // de inatividade (aviso + auto-encerramento).
  const [session, setSession] = useState<WorkoutSessionState | null>(() => loadWorkoutSession(workoutId));
  const [now, setNow] = useState(() => Date.now());
  const autoFinishTriggeredRef = useRef(false);

  const workoutQuery = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => getWorkout(workoutId),
  });

  // Fase 33.1: ordem estável usada tanto pra renderizar quanto pra saber
  // qual card vem "abaixo" de cada exercício, pro auto-scroll ao marcar
  // "Concluído". O último exercício rola até o card "Concluir sessão" — fim
  // natural do fluxo, em vez de não fazer nada.
  const sortedExercises = useMemo(() => {
    const exercises = workoutQuery.data?.workout.exercises ?? [];
    return [...exercises].sort((a, b) => a.order - b.order);
  }, [workoutQuery.data]);

  const completeMutation = useMutation({
    mutationFn: () => completeWorkout(workoutId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workout", workoutId] });
      // Perf (Grupo Y, item 100): antes invalidava o prefixo ["workout-program"]
      // inteiro — refetch em cascata de TODO programa em cache no app a cada
      // treino concluído. `programId` já vem no workout carregado; a sugestão
      // de próxima sessão (depende de `lastCompletedAt`) só precisa mesmo do
      // programa deste workout.
      queryClient.invalidateQueries({ queryKey: ["workout-program", workoutQuery.data?.workout.programId] });
      // Achado ao escopar a invalidação acima (Fase 96 introduziu isto sem
      // perceber): o resumo agregado do dashboard (`GET /api/dashboard/
      // aluno-summary`) embute o MESMO programa em detalhe, mas sob uma
      // chave de cache própria — nunca era tocado pela invalidação antiga do
      // prefixo ["workout-program"], então a sugestão de "próxima sessão" no
      // dashboard ficaria desatualizada depois de concluir um treino.
      queryClient.invalidateQueries({ queryKey: ["aluno-dashboard-summary"] });
      setSummary(data.summary);
    },
  });

  // Relógio vivo enquanto a sessão está aberta (em andamento ou em aviso de
  // inatividade) — reavalia "now" a cada segundo, o que recalcula a fase da
  // sessão e o tempo decorrido exibido nos botões.
  useEffect(() => {
    if (!session || summary) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session, summary]);

  // Qualquer clique/tecla conta como atividade enquanto a sessão está aberta
  // — não exige que o aluno marque uma série pra "provar" que ainda está ali
  // (ex: só consultando a instrução de um exercício já conta).
  useEffect(() => {
    if (!session || summary) return;
    function touch() {
      const nowTs = Date.now();
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, lastActivityAt: nowTs };
        saveWorkoutSession(workoutId, next);
        return next;
      });
    }
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [session, summary, workoutId]);

  const idleMs = session ? now - session.lastActivityAt : 0;
  const phase = workoutSessionPhase(session, now);

  // Auto-encerra quando o prazo de graça do aviso de inatividade esgota —
  // conta a duração até a ÚLTIMA atividade real, não até este instante, senão
  // o tempo parado no bolso do aluno também entraria na duração. A MESMA
  // regra cobre uma sessão "pendurada" de uma visita anterior (ex: aluno
  // fechou o app sem concluir e só voltou dias depois): como `now` já reflete
  // o instante real na primeira renderização, o efeito dispara imediatamente
  // no mount se a inatividade já for antiga o bastante — sem precisar de um
  // caminho de código separado pra "sessão velha".
  useEffect(() => {
    if (!session || summary || autoFinishTriggeredRef.current) return;
    if (idleMs < IDLE_AUTO_FINISH_MS) return;
    autoFinishTriggeredRef.current = true;
    setDurationSeconds(Math.round((session.lastActivityAt - session.startedAt) / 1000));
    clearWorkoutSession(workoutId);
    setSession(null);
    completeMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleMs, session, summary, workoutId]);

  function handleStartWorkout() {
    const nowTs = Date.now();
    const next: WorkoutSessionState = { startedAt: nowTs, lastActivityAt: nowTs };
    saveWorkoutSession(workoutId, next);
    setSession(next);
    setNow(nowTs);
  }

  function handleContinueAfterIdle() {
    const nowTs = Date.now();
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, lastActivityAt: nowTs };
      saveWorkoutSession(workoutId, next);
      return next;
    });
    setNow(nowTs);
  }

  function handleCompleteManually() {
    if (!session) return;
    setDurationSeconds(Math.round((Date.now() - session.startedAt) / 1000));
    clearWorkoutSession(workoutId);
    completeMutation.mutate();
  }

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

      {/* Fase 89: início explícito do cronômetro — antes a duração começava a
          contar já na abertura da tela (Fase 39), mesmo que o aluno só
          ficasse olhando os exercícios antes de treinar de verdade. */}
      <Card className="flex flex-col items-center gap-2">
        {phase === "not-started" ? (
          <Button onClick={handleStartWorkout} disabled={completeMutation.isPending} className="w-full">
            {t("startWorkout")}
          </Button>
        ) : (
          <>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("sessionInProgress")}
            </span>
            <span className="font-mono-nums text-3xl font-bold">
              {formatDuration(Math.round((now - (session?.startedAt ?? now)) / 1000))}
            </span>
          </>
        )}
      </Card>

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
          onClick={handleCompleteManually}
          disabled={completeMutation.isPending || !session}
          variant={allSetsDone ? "default" : "secondary"}
        >
          {completeMutation.isPending
            ? t("completing")
            : completeMutation.isSuccess
              ? t("sessionCompleted")
              : session
                ? `${t("completeSession")} (${formatDuration(Math.round((now - session.startedAt) / 1000))})`
                : t("startWorkoutFirst")}
        </Button>
        {completeMutation.isError && (
          <p className="text-sm text-danger">{t("completeError")}</p>
        )}
      </Card>

      {phase === "idle-warning" && (
        <IdleWarningModal
          remainingMs={IDLE_AUTO_FINISH_MS - idleMs}
          onContinue={handleContinueAfterIdle}
          onFinishNow={handleCompleteManually}
        />
      )}

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
