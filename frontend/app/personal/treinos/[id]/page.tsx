"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getWorkout } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { AddExerciseForm } from "@/components/add-exercise-form";

function PersonalWorkoutContent() {
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
  const exercises = [...(workout.exercises ?? [])].sort((a, b) => a.order - b.order);
  const nextOrder = exercises.length + 1;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          Treino {workout.letter}
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{workout.name}</h1>
        <p className="text-sm text-muted">{exercises.length} exercício(s) prescrito(s)</p>
      </div>

      {exercises.length > 0 && (
        <div className="flex flex-col gap-3">
          {exercises.map((ex) => (
            <Card key={ex.id} className="flex items-center justify-between">
              <div>
                <span className="font-mono-nums text-xs text-muted">#{ex.order}</span>{" "}
                <span className="font-semibold">{ex.exercise?.name}</span>
                <p className="text-xs text-muted">{ex.exercise?.muscleGroup}</p>
              </div>
              <div className="font-mono-nums text-sm text-muted">
                {ex.sets}x {ex.repsRange} · {ex.restSeconds}s
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">Adicionar exercício</h2>
        <AddExerciseForm workoutId={workoutId} nextOrder={nextOrder} />
      </Card>
    </main>
  );
}

export default function PersonalWorkoutPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <AppHeader />
      <PersonalWorkoutContent />
    </AuthGuard>
  );
}
