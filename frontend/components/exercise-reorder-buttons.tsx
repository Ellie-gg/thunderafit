"use client";

import { useMutation } from "@tanstack/react-query";
import { moveWorkoutExercise } from "@/lib/api/workouts";

/**
 * Fase 28: reordenar exercícios já prescritos (setas ↑/↓ — mais simples e
 * acessível que drag-and-drop). Assim como o `AddExerciseForm`, não assume
 * nenhuma query key: quem chama decide como invalidar/refetch via `onMoved`.
 */
export function ExerciseReorderButtons({
  workoutId,
  workoutExerciseId,
  disabledUp,
  disabledDown,
  onMoved,
}: {
  workoutId: string;
  workoutExerciseId: string;
  disabledUp: boolean;
  disabledDown: boolean;
  onMoved?: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (direction: "up" | "down") =>
      moveWorkoutExercise(workoutId, workoutExerciseId, direction),
    onSuccess: () => onMoved?.(),
  });

  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <button
        type="button"
        aria-label="Mover exercício para cima"
        disabled={disabledUp || mutation.isPending}
        onClick={() => mutation.mutate("up")}
        className="rounded border border-border px-1.5 py-0.5 text-xs leading-none text-muted hover:border-accent hover:text-foreground disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Mover exercício para baixo"
        disabled={disabledDown || mutation.isPending}
        onClick={() => mutation.mutate("down")}
        className="rounded border border-border px-1.5 py-0.5 text-xs leading-none text-muted hover:border-accent hover:text-foreground disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}
