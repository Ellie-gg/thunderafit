"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { deleteWorkoutExercise } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 65: antes só dava pra adicionar ou reordenar (↑/↓) um exercício
 * prescrito, nunca excluir. Mesmo padrão de confirmação inline (sem modal)
 * de `DeleteProgramButton` — primeiro clique vira "Tem certeza?", só o
 * segundo de fato apaga.
 */
export function ExerciseDeleteButton({
  workoutId,
  workoutExerciseId,
  onDeleted,
}: {
  workoutId: string;
  workoutExerciseId: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("exerciseDeleteButton");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteWorkoutExercise(workoutId, workoutExerciseId),
    onSuccess: () => {
      setConfirming(false);
      onDeleted?.();
    },
  });

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={t("deleteAriaLabel")}
        onClick={() => setConfirming(true)}
        className="rounded border border-border px-1.5 py-0.5 text-xs leading-none text-muted hover:border-danger hover:text-danger"
      >
        ✕
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-2">
      <p className="text-xs text-danger">{t("confirmDelete")}</p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("deleteError")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => setConfirming(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("deleting") : t("confirmDeleteButton")}
        </Button>
      </div>
    </div>
  );
}
