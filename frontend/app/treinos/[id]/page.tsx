"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getWorkout } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { VoltageBar } from "@/components/voltage-bar";
import { ExerciseExecutionCard } from "@/components/exercise-execution-card";

function ExecucaoContent() {
  const params = useParams<{ id: string }>();
  const workoutId = params.id;

  const workoutQuery = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => getWorkout(workoutId),
  });

  if (workoutQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">Carregando treino...</span>
      </main>
    );
  }

  if (workoutQuery.isError) {
    const message =
      workoutQuery.error instanceof ApiError
        ? workoutQuery.error.message
        : "Erro ao carregar o treino.";
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
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const doneSets = exercises.reduce((acc, ex) => acc + (ex.setLogs?.length ?? 0), 0);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          Treino {workout.letter}
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{workout.name}</h1>
        <div className="mt-2 flex items-center gap-3">
          <VoltageBar total={totalSets} filled={doneSets} className="max-w-xs" />
          <span className="font-mono-nums text-xs text-muted">
            {doneSets}/{totalSets}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {exercises
          .sort((a, b) => a.order - b.order)
          .map((ex) => (
            <ExerciseExecutionCard key={ex.id} workoutId={workoutId} workoutExercise={ex} />
          ))}
      </div>
    </main>
  );
}

export default function ExecucaoPage() {
  return (
    <AuthGuard>
      <AppHeader />
      <ExecucaoContent />
    </AuthGuard>
  );
}
