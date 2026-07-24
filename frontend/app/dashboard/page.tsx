"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listWorkoutPrograms, getWorkoutProgram } from "@/lib/api/workouts";
import { listMyDietPlans, getDietPlan } from "@/lib/api/nutrition";
import { getWeeklySummary } from "@/lib/api/progress";
import { listMyPersonals } from "@/lib/api/support";
import { useAuthStore } from "@/lib/store/auth-store";
import { labelFor } from "@/lib/session-scheme";
import { firstNameOrEmailPrefix } from "@/lib/utils";
import type { WorkoutProgram } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { WeeklyVoltageBar } from "@/components/weekly-voltage-bar";
import { WeeklyStats } from "@/components/weekly-stats";
import { QueryError } from "@/components/query-error";

// Fase 33.4: tempo estimado da sessão — heurística client-side (sem schema
// novo), ~40s de execução por série + o descanso prescrito entre elas. É uma
// ESTIMATIVA pro aluno decidir se começa agora, não uma medição real.
const ESTIMATED_SECONDS_PER_SET = 40;

function estimateSessionMinutes(exercises: Array<{ sets: number; restSeconds: number }>): number {
  const totalSeconds = exercises.reduce(
    (acc, ex) => acc + ex.sets * (ESTIMATED_SECONDS_PER_SET + ex.restSeconds),
    0
  );
  return Math.max(1, Math.round(totalSeconds / 60));
}

// Fase 36: mesmo card de "próxima sessão" serve os dois blocos do dashboard
// ("Prescrito pelo seu Personal" e "Meus treinos") — só muda qual programa
// (já carregado com detalhe via getWorkoutProgram) é passado.
function NextSessionCard({ program }: { program: WorkoutProgram }) {
  const t = useTranslations("alunoDashboard");
  const sessions = program.workouts ?? [];
  const nextSession = sessions.find((s) => s.suggestedNext) ?? sessions[0];
  if (!nextSession) return null;

  const nextExercises = nextSession.exercises ?? [];
  const totalSets = nextExercises.reduce((acc, ex) => acc + ex.sets, 0);
  const doneSets = nextExercises.reduce((acc, ex) => acc + (ex.setLogs?.length ?? 0), 0);
  const estimatedMinutes = nextExercises.length > 0 ? estimateSessionMinutes(nextExercises) : 0;

  return (
    <Card className="flex flex-col gap-4 border-accent/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          {program.name}
        </span>
        <span className="font-mono-nums text-xs text-muted">
          {t("setsCount", { done: doneSets, total: totalSets })}
        </span>
      </div>
      <h2 className="font-display text-xl font-bold">
        {labelFor(program.sessionScheme, nextSession.letter)} — {nextSession.name}
      </h2>
      <p className="text-xs text-muted">
        {t("exerciseCount", { count: nextExercises.length })}
        {estimatedMinutes > 0 && t("estimatedMinutesSuffix", { minutes: estimatedMinutes })}
      </p>
      <VoltageBar total={totalSets} filled={doneSets} role="ALUNO" />
      <Button asChild>
        <Link href={`/treinos/${nextSession.id}`}>{t("startWorkout")}</Link>
      </Button>
    </Card>
  );
}

function buildPersonalInviteText(t: ReturnType<typeof useTranslations>) {
  // Fase 24 (Parte 2): /register não existe mais — o cadastro acontece
  // dentro do fluxo unificado de e-mail em /login (mesma base do convite já
  // usado em VincularAlunoForm, Fase 12 — só muda a direção: aqui é o aluno
  // convidando um Personal, não o contrário).
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  return t("inviteText", { loginUrl });
}

// Fase 36: convite copiável quando o aluno ainda não tem nenhum Personal
// vinculado — mesmo padrão de "copiar texto pronto + feedback de copiado"
// já usado em VincularAlunoForm (Fase 12).
function InvitePersonalCard() {
  const t = useTranslations("alunoDashboard");
  const [copied, setCopied] = useState(false);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold">{t("noPersonalTitle")}</h2>
      <p className="text-sm text-muted">{t("noPersonalDescription")}</p>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(buildPersonalInviteText(t));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? t("inviteCopied") : t("copyInvite")}
      </Button>
    </Card>
  );
}

function DashboardContent() {
  const t = useTranslations("alunoDashboard");
  const user = useAuthStore((s) => s.user);

  const programsQuery = useQuery({
    queryKey: ["workout-programs", "aluno"],
    queryFn: () => listWorkoutPrograms(),
  });

  const allPrograms = programsQuery.data?.programs ?? [];
  // Fase 34.5: a listagem do aluno traz os dois origins misturados
  // (prescrito pelo Personal + templates "Meu treino pessoal" aplicados) —
  // o dashboard os separa em 2 blocos claros (Fase 36), cada um com sua
  // própria "próxima sessão".
  const personalPrograms = useMemo(
    () => allPrograms.filter((p) => p.origin === "PERSONAL"),
    [allPrograms]
  );
  const selfPrograms = useMemo(
    () => allPrograms.filter((p) => p.origin === "SELF"),
    [allPrograms]
  );
  const activePersonalProgramId = personalPrograms[0]?.id;
  const activeSelfProgramId = selfPrograms[0]?.id;

  const personalProgramQuery = useQuery({
    queryKey: ["workout-program", activePersonalProgramId],
    queryFn: () => getWorkoutProgram(activePersonalProgramId!),
    enabled: !!activePersonalProgramId,
  });
  const selfProgramQuery = useQuery({
    queryKey: ["workout-program", activeSelfProgramId],
    queryFn: () => getWorkoutProgram(activeSelfProgramId!),
    enabled: !!activeSelfProgramId,
  });
  // Enquanto a busca do detalhe de um programa que EXISTE ainda não voltou,
  // não mostra nenhum fallback (nem "sem treino", nem convite) — só some o
  // card por um instante, em vez de piscar uma mensagem errada.
  const personalDetailPending = !!activePersonalProgramId && !personalProgramQuery.data;
  const selfDetailPending = !!activeSelfProgramId && !selfProgramQuery.data;

  const weeklySummaryQuery = useQuery({
    queryKey: ["weekly-summary"],
    queryFn: () => getWeeklySummary(),
  });
  const weeklySummary = weeklySummaryQuery.data;

  // Fase 17 (Item 5): "plano alimentar de hoje" agora usa o plano ATIVO
  // (isActive) em vez do primeiro da lista — a vigência substituiu a
  // simplificação anterior. Fallback ao primeiro caso nenhum esteja marcado.
  const dietPlansQuery = useQuery({
    queryKey: ["diet-plans"],
    queryFn: listMyDietPlans,
  });

  const activePlanId = useMemo(
    () => (dietPlansQuery.data?.plans.find((p) => p.isActive) ?? dietPlansQuery.data?.plans[0])?.id,
    [dietPlansQuery.data]
  );

  const dietPlanDetailQuery = useQuery({
    queryKey: ["diet-plan", activePlanId],
    queryFn: () => getDietPlan(activePlanId!),
    enabled: !!activePlanId,
  });

  const dietPlan = dietPlanDetailQuery.data?.plan;
  const hasNutricionista = dietPlansQuery.isSuccess && dietPlansQuery.data.plans.length > 0;

  // Fase 36: "tem Personal vinculado" não pode mais ser inferido de "tem
  // programa" (um programa origin: SELF não implica Personal nenhum, ao
  // contrário do que valia antes da Fase 34.5) — usa o vínculo real
  // (ClientRelation), já exposto pro aluno via /api/support/my-personals.
  const myPersonalsQuery = useQuery({ queryKey: ["my-personals"], queryFn: listMyPersonals });
  const hasPersonalRelation =
    myPersonalsQuery.isSuccess &&
    myPersonalsQuery.data.personals.some((p) => p.professionalType === "PERSONAL");

  const hasAnythingYet = allPrograms.length > 0 || hasNutricionista;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("greeting", { name: firstNameOrEmailPrefix(user) })}
          </h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        {programsQuery.isLoading && <p className="text-sm text-muted">{t("loadingWorkouts")}</p>}

        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        {programsQuery.isSuccess &&
          myPersonalsQuery.isSuccess &&
          !hasAnythingYet &&
          !hasPersonalRelation && (
            <Card>
              <p className="text-sm text-muted">{t("noProgramsYet")}</p>
            </Card>
          )}

        {/* Bloco 1 (Fase 36): treinos prescritos por um Personal de verdade. */}
        {programsQuery.isSuccess && (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("personalPrescribedLabel")}
            </span>
            {personalDetailPending ? null : personalProgramQuery.data?.program ? (
              <NextSessionCard program={personalProgramQuery.data.program} />
            ) : hasPersonalRelation ? (
              <Card>
                <p className="text-sm text-muted">{t("noPersonalPrescription")}</p>
              </Card>
            ) : (
              myPersonalsQuery.isSuccess && <InvitePersonalCard />
            )}
          </div>
        )}

        {/* Bloco 2 (Fase 36): templates "Meu treino pessoal" (Fase 34.5) já aplicados. */}
        {programsQuery.isSuccess && (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("myWorkoutsLabel")}
            </span>
            {selfDetailPending ? null : selfProgramQuery.data?.program ? (
              <NextSessionCard program={selfProgramQuery.data.program} />
            ) : (
              <Card className="flex flex-col gap-2">
                <p className="text-sm text-muted">{t("selfWorkoutsEmpty")}</p>
                <Button asChild variant="secondary">
                  <Link href="/meu-treino-pessoal">{t("viewAvailableWorkouts")}</Link>
                </Button>
              </Card>
            )}
          </div>
        )}

        {weeklySummary && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("last7Days")}
            </span>
            <WeeklyVoltageBar days={weeklySummary.days} />
          </div>
        )}

        {allPrograms.length > 0 && (
          <Link href="/programas" className="text-sm font-semibold text-accent-secondary hover:underline">
            {t("viewAllPrograms")}
          </Link>
        )}

        {dietPlansQuery.isError && (
          <QueryError error={dietPlansQuery.error} onRetry={() => dietPlansQuery.refetch()} />
        )}

        {dietPlan && (
          <Card className="flex flex-col gap-4 border-accent-secondary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("todayDietPlan")}
              </span>
              <span className="font-mono-nums text-xs text-muted">
                {t("kcalLabel", { kcal: dietPlan.totalMacros.kcal })}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">{dietPlan.name}</h2>
            <div className="grid grid-cols-3 gap-2 font-mono-nums text-xs text-muted">
              <span>{t("proteinLabel", { value: dietPlan.totalMacros.proteinG })}</span>
              <span>{t("carbsLabel", { value: dietPlan.totalMacros.carbsG })}</span>
              <span>{t("fatLabel", { value: dietPlan.totalMacros.fatG })}</span>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/dieta/${dietPlan.id}`}>{t("viewFullPlan")}</Link>
            </Button>
          </Card>
        )}

        {weeklySummary && (
          <WeeklyStats setsThisWeek={weeklySummary.setsThisWeek} streakDays={weeklySummary.streakDays} />
        )}

        {/* Atalhos visíveis também aqui (não só no AppHeader) — no celular,
            os links de texto do header ficam escondidos por falta de espaço.
            Fase 33.4: 3 ícones de peso visual igual (em vez de links de texto
            soltos), em violeta — claramente secundários ao hero. */}
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 sm:hidden">
          {[
            { href: "/evolucao", icon: "📈", label: t("shortcutEvolution") },
            { href: "/anamnese", icon: "📋", label: t("shortcutAnamnesis") },
            { href: "/duvidas", icon: "💬", label: t("shortcutQuestions") },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-md py-2 text-center"
              style={{ color: "var(--role-nutricionista)" }}
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <DashboardContent />
    </AuthGuard>
  );
}
