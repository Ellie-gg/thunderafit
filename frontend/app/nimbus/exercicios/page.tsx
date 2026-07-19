"use client";

import { useMemo, useState } from "react";
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

function ExerciciosContent() {
  const queryClient = useQueryClient();
  const exercisesQuery = useQuery({ queryKey: ["admin", "exercises"], queryFn: listAdminExercises });
  const [form, setForm] = useState<FormState>({ mode: "closed" });

  const exercises = useMemo(() => exercisesQuery.data?.exercises ?? [], [exercisesQuery.data]);

  const categories = useMemo(() => {
    const set = new Set(exercises.map((e) => e.muscleGroup));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [exercises]);

  function refetchAndClose() {
    queryClient.invalidateQueries({ queryKey: ["admin", "exercises"] });
    setForm({ mode: "closed" });
  }

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Catálogo de Exercícios
            </h1>
            <p className="text-sm text-muted">
              {exercises.length} exercício(s). Excluir um exercício em uso numa prescrição não é
              permitido.
            </p>
          </div>
          {form.mode === "closed" && (
            <Button type="button" onClick={() => setForm({ mode: "create" })}>
              Novo exercício
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

        {exercisesQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {exercisesQuery.isError && (
          <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
        )}

        {exercisesQuery.isSuccess && (
          <Card className="flex flex-col gap-2">
            {exercises.map((ex) => (
              <div key={ex.id} className="rounded-md border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{ex.name}</span>
                    <span className="text-xs text-muted">
                      {ex.muscleGroup} · {ex.equipment} · {ex.mediaType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ex.isFeatured && (
                      <span className="shrink-0 rounded-full border border-accent-secondary px-2 py-0.5 text-xs font-semibold text-accent-secondary">
                        ★ Destaque
                      </span>
                    )}
                    <DifficultyBadge level={ex.difficultyLevel} />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setForm(
                          form.mode === "edit" && form.exercise.id === ex.id
                            ? { mode: "closed" }
                            : { mode: "edit", exercise: ex }
                        )
                      }
                    >
                      {form.mode === "edit" && form.exercise.id === ex.id ? "Fechar" : "Editar"}
                    </Button>
                    <DeleteExerciseButton exerciseId={ex.id} onDeleted={refetchAndClose} />
                  </div>
                </div>
                {form.mode === "edit" && form.exercise.id === ex.id && (
                  <div className="border-t border-border p-3">
                    <AdminExerciseForm
                      exercise={form.exercise}
                      categories={categories}
                      onSaved={refetchAndClose}
                      onCancel={() => setForm({ mode: "closed" })}
                    />
                  </div>
                )}
              </div>
            ))}
            {exercises.length === 0 && (
              <p className="text-sm text-muted">Nenhum exercício cadastrado.</p>
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
