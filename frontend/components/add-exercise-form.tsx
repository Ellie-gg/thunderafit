"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listExercises, addWorkoutExercise } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

export function AddExerciseForm({
  workoutId,
  nextOrder,
}: {
  workoutId: string;
  nextOrder: number;
}) {
  const queryClient = useQueryClient();
  const exercisesQuery = useQuery({ queryKey: ["exercises"], queryFn: listExercises });

  const [filter, setFilter] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("3");
  const [repsRange, setRepsRange] = useState("8-12");
  const [restSeconds, setRestSeconds] = useState("60");

  const filtered = useMemo(() => {
    const all = exercisesQuery.data?.exercises ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
    );
  }, [exercisesQuery.data, filter]);

  const mutation = useMutation({
    mutationFn: () =>
      addWorkoutExercise(workoutId, {
        exerciseId,
        sets: Number(sets),
        repsRange,
        restSeconds: Number(restSeconds),
        order: nextOrder,
      }),
    onSuccess: () => {
      setExerciseId("");
      queryClient.invalidateQueries({ queryKey: ["workout", workoutId] });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      {exercisesQuery.isLoading && <p className="text-sm text-muted">Carregando catálogo...</p>}

      {exercisesQuery.isError && (
        <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter">Buscar exercício (nome ou grupo muscular)</Label>
        <Input
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Ex: supino, peito..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exercise">Exercício</Label>
        <select
          id="exercise"
          required
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="" disabled>
            {filtered.length} exercício(s) — selecione
          </option>
          {filtered.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} ({ex.muscleGroup})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sets">Séries</Label>
          <Input
            id="sets"
            type="number"
            min={1}
            required
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="repsRange">Reps</Label>
          <Input
            id="repsRange"
            required
            value={repsRange}
            onChange={(e) => setRepsRange(e.target.value)}
            placeholder="8-12"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rest">Descanso (s)</Label>
          <Input
            id="rest"
            type="number"
            min={0}
            required
            value={restSeconds}
            onChange={(e) => setRestSeconds(e.target.value)}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : "Erro ao adicionar exercício."}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending || !exerciseId}>
        {mutation.isPending ? "Adicionando..." : `Adicionar exercício (posição ${nextOrder})`}
      </Button>
    </form>
  );
}
