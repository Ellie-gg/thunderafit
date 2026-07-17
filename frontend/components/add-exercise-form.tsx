"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listExercises, addWorkoutExercise } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { DifficultyBadge } from "@/components/difficulty-badge";

const ALL_GROUPS = "Todos";

export function AddExerciseForm({
  workoutId,
  nextOrder,
}: {
  workoutId: string;
  nextOrder: number;
}) {
  const queryClient = useQueryClient();
  // Carrega o catálogo inteiro uma vez e filtra no cliente. O backend também
  // aceita ?muscleGroup= (usado por outros clientes/testes), mas com ~150
  // itens carregar tudo uma vez e alternar grupos sem refetch é mais fluido.
  const exercisesQuery = useQuery({ queryKey: ["exercises"], queryFn: () => listExercises() });

  const [group, setGroup] = useState(ALL_GROUPS);
  const [filter, setFilter] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("3");
  const [repsRange, setRepsRange] = useState("8-12");
  const [restSeconds, setRestSeconds] = useState("60");

  const all = exercisesQuery.data?.exercises ?? [];

  const groups = useMemo(() => {
    const set = new Set(all.map((e) => e.muscleGroup));
    return [ALL_GROUPS, ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [all]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return all.filter((e) => {
      if (group !== ALL_GROUPS && e.muscleGroup !== group) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
    });
  }, [all, group, filter]);

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

      {/* Filtro por grupo muscular (tabs roláveis) — 150 itens num dropdown único
          seria ruim de navegar (Fase 15). */}
      <div className="flex flex-col gap-1.5">
        <Label>Grupo muscular</Label>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const active = g === group;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                aria-pressed={active}
                className={
                  active
                    ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
                    : "rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent"
                }
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter">Buscar por nome</Label>
        <Input
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Ex: supino, agachamento..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Exercício ({filtered.length})</Label>
        <div
          className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-2"
          role="listbox"
          aria-label="Exercícios"
        >
          {filtered.map((ex) => {
            const selected = ex.id === exerciseId;
            // O link de vídeo fica FORA do <button> (elementos interativos não
            // podem aninhar) — permite ao Personal conferir a execução antes de
            // prescrever (Fase 17, Item 2).
            return (
              <div
                key={ex.id}
                className={
                  selected
                    ? "flex items-center gap-2 rounded-md border border-accent bg-accent/10 pr-2"
                    : "flex items-center gap-2 rounded-md border border-transparent pr-2 hover:border-border"
                }
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setExerciseId(ex.id)}
                  className="flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{ex.name}</span>
                    <span className="text-xs text-muted">
                      {ex.muscleGroup} · {ex.equipment}
                    </span>
                  </span>
                  <DifficultyBadge level={ex.difficultyLevel} />
                </button>
                {ex.mediaUrl && (
                  <a
                    href={ex.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-accent-secondary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ▶ vídeo
                  </a>
                )}
              </div>
            );
          })}
          {exercisesQuery.isSuccess && filtered.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted">Nenhum exercício neste filtro.</p>
          )}
        </div>
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
