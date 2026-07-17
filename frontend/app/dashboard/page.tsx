"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listWorkoutPrograms, getWorkoutProgram } from "@/lib/api/workouts";
import { listMyDietPlans, getDietPlan } from "@/lib/api/nutrition";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";
import { EvolucaoTeaser } from "@/components/evolucao-teaser";

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
  const totalSets = nextSession?.exercises?.reduce((acc, ex) => acc + ex.sets, 0) ?? 0;
  const doneSets =
    nextSession?.exercises?.reduce((acc, ex) => acc + (ex.setLogs?.length ?? 0), 0) ?? 0;

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
            Olá, {user?.email.split("@")[0]}
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

        {nextSession && (
          <Card className="flex flex-col gap-4 border-accent/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                Sessão sugerida
              </span>
              <span className="font-mono-nums text-xs text-muted">
                {doneSets}/{totalSets} séries
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">
              Sessão {nextSession.letter} — {nextSession.name}
            </h2>
            {program && <p className="text-xs text-muted">Programa: {program.name}</p>}
            <VoltageBar total={totalSets} filled={doneSets} role="ALUNO" />
            <Button asChild>
              <Link href={`/treinos/${nextSession.id}`}>Começar treino</Link>
            </Button>
          </Card>
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

        <EvolucaoTeaser />

        {/* Atalhos visíveis também aqui (não só no AppHeader) — no celular,
            os links de texto do header ficam escondidos por falta de espaço. */}
        <div className="flex flex-wrap gap-4 border-t border-border pt-4 sm:hidden">
          <Link href="/evolucao" className="text-sm font-semibold text-accent-secondary hover:underline">
            Evolução
          </Link>
          <Link href="/anamnese" className="text-sm font-semibold text-accent-secondary hover:underline">
            Anamnese
          </Link>
          <Link href="/duvidas" className="text-sm font-semibold text-accent-secondary hover:underline">
            Dúvidas
          </Link>
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
