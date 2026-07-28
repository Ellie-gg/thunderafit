"use client";

import { useTranslations } from "next-intl";
import type { WorkoutExercise } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { ExerciseMedia } from "@/components/exercise-media";

/**
 * Fase 65 — "Ver como o aluno vê": o Personal só tinha a lista de edição
 * (nome + sets/reps numa linha só) pra conferir o que prescreveu. Este card
 * reaproveita a MESMA parte visual/de mídia de `ExerciseExecutionCard` (nome,
 * vídeo/gif de demonstração, descrição, prescrição, observação) mas
 * deliberadamente SEM nada interativo que grave dado do aluno — sem
 * checkbox de concluído, sem `VoltageBar` de séries, sem formulário de
 * registrar série. Puro preview, somente leitura (decisão do fundador:
 * "modo leitura, só visual", não o progresso real do aluno).
 */
export function ExercisePreviewCard({ workoutExercise }: { workoutExercise: WorkoutExercise }) {
  const t = useTranslations("exerciseExecutionCard");

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-bold">{workoutExercise.exercise?.name}</h3>

      <ExerciseMedia exercise={workoutExercise.exercise} />

      <p className="text-sm text-muted">{workoutExercise.exercise?.description}</p>

      <p className="text-xs text-muted">
        {t("prescribedInfo", {
          sets: workoutExercise.sets,
          repsRange: workoutExercise.repsRange,
          restSeconds: workoutExercise.restSeconds,
        })}
      </p>

      {workoutExercise.notes && (
        <p className="rounded-md border border-accent-secondary/30 bg-accent-secondary/10 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold text-accent-secondary">{t("personalNoteLabel")}</span>
          {workoutExercise.notes}
        </p>
      )}
    </Card>
  );
}
