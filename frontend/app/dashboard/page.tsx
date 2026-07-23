"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listWorkoutPrograms, getWorkoutProgram } from "@/lib/api/workouts";
import { listMyDietPlans, getDietPlan } from "@/lib/api/nutrition";
import { getWeeklySummary } from "@/lib/api/progress";
import { useAuthStore } from "@/lib/store/auth-store";
import { labelFor } from "@/lib/session-scheme";
import { firstNameOrEmailPrefix } from "@/lib/utils";
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

function DashboardContent() {
  const user = useAuthStore((s) => s.user);

  // Fase 17 (Item 1): o card de "próximo treino" passa a refletir a sessão
  // sugerida (`suggestedNext`, regra da Fase 16) do programa ativo do aluno —
  // não mais o treino mais antigo da lista. Programa ativo = o mais recente
  // aplicado ao aluno (listWorkoutPrograms já vem ordenado por createdAt desc).
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "aluno"],
    queryFn: () => listWorkoutPrograms(),
  });

  const activeProgramId = programsQuery.data?.programs[0]?.id;

  const programQuery = useQuery({
    queryKey: ["workout-program", activeProgramId],
    queryFn: () => getWorkoutProgram(activeProgramId!),
    enabled: !!activeProgramId,
  });

  const program = programQuery.data?.program;
  const sessions = program?.workouts ?? [];
  const nextSession = sessions.find((s) => s.suggestedNext) ?? sessions[0];
  const nextExercises = nextSession?.exercises ?? [];
  const totalSets = nextExercises.reduce((acc, ex) => acc + ex.sets, 0);
  const doneSets = nextExercises.reduce((acc, ex) => acc + (ex.setLogs?.length ?? 0), 0);
  const estimatedMinutes = nextExercises.length > 0 ? estimateSessionMinutes(nextExercises) : 0;

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

  const activePlanId =
    (dietPlansQuery.data?.plans.find((p) => p.isActive) ?? dietPlansQuery.data?.plans[0])?.id;

  const dietPlanDetailQuery = useQuery({
    queryKey: ["diet-plan", activePlanId],
    queryFn: () => getDietPlan(activePlanId!),
    enabled: !!activePlanId,
  });

  const dietPlan = dietPlanDetailQuery.data?.plan;
  const hasPersonal = programsQuery.isSuccess && programsQuery.data.programs.length > 0;
  const hasNutricionista = dietPlansQuery.isSuccess && dietPlansQuery.data.plans.length > 0;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Olá, {firstNameOrEmailPrefix(user)}
          </h1>
          <p className="text-sm text-muted">Pronto para descarregar o treino de hoje?</p>
        </div>

        {programsQuery.isLoading && <p className="text-sm text-muted">Carregando treinos...</p>}

        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        {programsQuery.isSuccess && !hasPersonal && !hasNutricionista && (
          <Card>
            <p className="text-sm text-muted">
              Você ainda não tem nenhum treino ou plano de dieta prescrito. Fale com seu Personal
              Trainer ou Nutricionista.
            </p>
          </Card>
        )}

        {nextSession && program && (
          <Card className="flex flex-col gap-4 border-accent/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {program.name}
              </span>
              <span className="font-mono-nums text-xs text-muted">
                {doneSets}/{totalSets} séries
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">
              {labelFor(program.sessionScheme, nextSession.letter)} — {nextSession.name}
            </h2>
            <p className="text-xs text-muted">
              {nextExercises.length} exercício{nextExercises.length === 1 ? "" : "s"}
              {estimatedMinutes > 0 && ` · ~${estimatedMinutes} min`}
            </p>
            <VoltageBar total={totalSets} filled={doneSets} role="ALUNO" />
            <Button asChild>
              <Link href={`/treinos/${nextSession.id}`}>Começar treino</Link>
            </Button>
          </Card>
        )}

        {weeklySummary && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Últimos 7 dias
            </span>
            <WeeklyVoltageBar days={weeklySummary.days} />
          </div>
        )}

        {hasPersonal && (
          <Link href="/programas" className="text-sm font-semibold text-accent-secondary hover:underline">
            Ver todos os meus programas →
          </Link>
        )}

        {dietPlansQuery.isError && (
          <QueryError error={dietPlansQuery.error} onRetry={() => dietPlansQuery.refetch()} />
        )}

        {dietPlan && (
          <Card className="flex flex-col gap-4 border-accent-secondary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                Plano alimentar de hoje
              </span>
              <span className="font-mono-nums text-xs text-muted">
                {dietPlan.totalMacros.kcal} kcal
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">{dietPlan.name}</h2>
            <div className="grid grid-cols-3 gap-2 font-mono-nums text-xs text-muted">
              <span>{dietPlan.totalMacros.proteinG}g proteína</span>
              <span>{dietPlan.totalMacros.carbsG}g carbo</span>
              <span>{dietPlan.totalMacros.fatG}g gordura</span>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/dieta/${dietPlan.id}`}>Ver plano completo</Link>
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
            { href: "/evolucao", icon: "📈", label: "Evolução" },
            { href: "/anamnese", icon: "📋", label: "Anamnese" },
            { href: "/duvidas", icon: "💬", label: "Dúvidas" },
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
