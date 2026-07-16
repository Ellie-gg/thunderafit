"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listMyWorkouts, getWorkout } from "@/lib/api/workouts";
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

  const workoutsQuery = useQuery({
    queryKey: ["workouts"],
    queryFn: listMyWorkouts,
  });

  const firstWorkoutId = workoutsQuery.data?.workouts[0]?.id;

  const detailQuery = useQuery({
    queryKey: ["workout", firstWorkoutId],
    queryFn: () => getWorkout(firstWorkoutId!),
    enabled: !!firstWorkoutId,
  });

  const workout = detailQuery.data?.workout;
  const totalSets = workout?.exercises?.reduce((acc, ex) => acc + ex.sets, 0) ?? 0;
  const doneSets =
    workout?.exercises?.reduce((acc, ex) => acc + (ex.setLogs?.length ?? 0), 0) ?? 0;

  // Fase 11 — um aluno pode ter Personal, Nutricionista, ambos ou nenhum.
  // "Plano alimentar de hoje" segue a mesma simplificação documentada desde
  // a Fase 5 para "próximo treino": não existe conceito de dia no backend,
  // então usamos o primeiro plano de dieta prescrito.
  const dietPlansQuery = useQuery({
    queryKey: ["diet-plans"],
    queryFn: listMyDietPlans,
  });

  const firstPlanId = dietPlansQuery.data?.plans[0]?.id;

  const dietPlanDetailQuery = useQuery({
    queryKey: ["diet-plan", firstPlanId],
    queryFn: () => getDietPlan(firstPlanId!),
    enabled: !!firstPlanId,
  });

  const dietPlan = dietPlanDetailQuery.data?.plan;
  const hasPersonal = workoutsQuery.isSuccess && workoutsQuery.data.workouts.length > 0;
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

        {workoutsQuery.isLoading && <p className="text-sm text-muted">Carregando treinos...</p>}

        {workoutsQuery.isError && (
          <QueryError error={workoutsQuery.error} onRetry={() => workoutsQuery.refetch()} />
        )}

        {workoutsQuery.isSuccess && !hasPersonal && !hasNutricionista && (
          <Card>
            <p className="text-sm text-muted">
              Você ainda não tem nenhum treino ou plano de dieta prescrito. Fale com seu Personal
              Trainer ou Nutricionista.
            </p>
          </Card>
        )}

        {workout && (
          <Card className="flex flex-col gap-4 border-accent/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                Próximo treino
              </span>
              <span className="font-mono-nums text-xs text-muted">
                {doneSets}/{totalSets} séries
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">
              Treino {workout.letter} — {workout.name}
            </h2>
            <VoltageBar total={totalSets} filled={doneSets} role="ALUNO" />
            <Button asChild>
              <Link href={`/treinos/${workout.id}`}>Começar treino</Link>
            </Button>
          </Card>
        )}

        {hasPersonal && (
          <Link href="/treinos" className="text-sm font-semibold text-accent-secondary hover:underline">
            Ver todos os meus treinos →
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
