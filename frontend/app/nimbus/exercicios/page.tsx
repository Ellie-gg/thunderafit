"use client";

import { useTranslations } from "next-intl";
import { memo, useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAdminExercises } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { AdminExerciseForm } from "@/components/admin-exercise-form";
import { DeleteExerciseButton } from "@/components/delete-exercise-button";
import type { Exercise } from "@/lib/types";

type FormState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; exercise: Exercise };

type ExerciseRowProps = {
  exercise: Exercise;
  categories: string[];
  isEditing: boolean;
  featuredLabel: string;
  editLabel: string;
  closeLabel: string;
  onToggleEdit: (exercise: Exercise) => void;
  onSaved: () => void;
};

const ExerciseRow = memo(function ExerciseRow({
  exercise,
  categories,
  isEditing,
  featuredLabel,
  editLabel,
  closeLabel,
  onToggleEdit,
  onSaved,
}: ExerciseRowProps) {
  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{exercise.name}</span>
          <span className="text-xs text-muted">
            {exercise.muscleGroup} · {exercise.equipment} · {exercise.mediaType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exercise.isFeatured && (
            <span className="shrink-0 rounded-full border border-accent-secondary px-2 py-0.5 text-xs font-semibold text-accent-secondary">
              {featuredLabel}
            </span>
          )}
          <DifficultyBadge level={exercise.difficultyLevel} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onToggleEdit(exercise)}
          >
            {isEditing ? closeLabel : editLabel}
          </Button>
          <DeleteExerciseButton exerciseId={exercise.id} onDeleted={onSaved} />
        </div>
      </div>
      {isEditing && (
        <div className="border-t border-border p-3">
          <AdminExerciseForm
            exercise={exercise}
            categories={categories}
            onSaved={onSaved}
            onCancel={() => onToggleEdit(exercise)}
          />
        </div>
      )}
    </div>
  );
});

function ExerciciosContent() {
  const t = useTranslations("nimbusExercicios");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const exercisesQuery = useQuery({ queryKey: ["admin", "exercises"], queryFn: listAdminExercises });
  const [form, setForm] = useState<FormState>({ mode: "closed" });

  const exercises = useMemo(() => exercisesQuery.data?.exercises ?? [], [exercisesQuery.data]);

  const categories = useMemo(() => {
    const set = new Set(exercises.map((e) => e.muscleGroup));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [exercises]);

  const refetchAndClose = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "exercises"] });
    setForm({ mode: "closed" });
  }, [queryClient]);

  const handleToggleEdit = useCallback((exercise: Exercise) => {
    setForm((prev) =>
      prev.mode === "edit" && prev.exercise.id === exercise.id
        ? { mode: "closed" }
        : { mode: "edit", exercise }
    );
  }, []);

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-sm text-muted">
              {t("count", { count: exercises.length })}
            </p>
          </div>
          {form.mode === "closed" && exercisesQuery.isSuccess && (
            <Button type="button" onClick={() => setForm({ mode: "create" })}>
              {t("newExercise")}
            </Button>
          )}
        </div>

        {form.mode === "create" && (
          <AdminExerciseForm
            categories={categories}
            onSaved={refetchAndClose}
            onCancel={() => setForm({ mode: "closed" })}
          />
        )}

        {exercisesQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {exercisesQuery.isError && (
          <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
        )}

        {exercisesQuery.isSuccess && (
          <Card className="flex flex-col gap-2">
            {exercises.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                categories={categories}
                isEditing={form.mode === "edit" && form.exercise.id === ex.id}
                featuredLabel={t("featured")}
                editLabel={t("edit")}
                closeLabel={t("close")}
                onToggleEdit={handleToggleEdit}
                onSaved={refetchAndClose}
              />
            ))}
            {exercises.length === 0 && (
              <p className="text-sm text-muted">{t("empty")}</p>
            )}
          </Card>
        )}
      </main>
    </>
  );
}

export default function AdminExerciciosPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <ExerciciosContent />
    </AuthGuard>
  );
}
