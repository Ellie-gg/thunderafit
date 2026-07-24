"use client";

import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { moveWorkoutExercise } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";

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
  const t = useTranslations("exerciseReorderButtons");
  const mutation = useMutation({
    mutationFn: (direction: "up" | "down") =>
      moveWorkoutExercise(workoutId, workoutExerciseId, direction),
    onSuccess: () => onMoved?.(),
  });

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={t("moveUpAriaLabel")}
        disabled={disabledUp || mutation.isPending}
        onClick={() => mutation.mutate("up")}
        className="rounded border border-border px-1.5 py-0.5 text-xs leading-none text-muted hover:border-accent hover:text-foreground disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={t("moveDownAriaLabel")}
        disabled={disabledDown || mutation.isPending}
        onClick={() => mutation.mutate("down")}
        className="rounded border border-border px-1.5 py-0.5 text-xs leading-none text-muted hover:border-accent hover:text-foreground disabled:opacity-30"
      >
        ↓
      </button>
      {/* Sem isso, qualquer 400/500 (ex: clique disparado antes do estado
          disabled atualizar) falhava em silêncio — parecia "travado" porque
          nada acontecia visivelmente, mas não era um erro fatal. */}
      {mutation.isError && (
        <span className="w-16 text-center text-[10px] leading-tight text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("moveError")}
        </span>
      )}
    </div>
  );
}
