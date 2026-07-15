"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listMyWorkouts, getWorkout } from "@/lib/api/workouts";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";

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

        {workoutsQuery.isSuccess && workoutsQuery.data.workouts.length === 0 && (
          <Card>
            <p className="text-sm text-muted">
              Você ainda não tem nenhum treino prescrito. Fale com seu Personal Trainer.
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
            <VoltageBar total={totalSets} filled={doneSets} />
            <Button asChild>
              <Link href={`/treinos/${workout.id}`}>Começar treino</Link>
            </Button>
          </Card>
        )}

        <Link href="/treinos" className="text-sm font-semibold text-accent-secondary hover:underline">
          Ver todos os meus treinos →
        </Link>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
