"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  listExercises,
  generateWorkoutDraft,
  createWorkoutProgram,
  addProgramSession,
  addWorkoutExercise,
  type WorkoutGoal,
  type GeneratedExercise,
} from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

const GOAL_OPTIONS: Array<{ value: WorkoutGoal; label: string }> = [
  { value: "hipertrofia", label: "Hipertrofia" },
  { value: "forca", label: "Força" },
  { value: "resistencia", label: "Resistência" },
];

// "Montagem Inteligente": motor de regras determinístico, sem IA externa.
// Fluxo em 2 passos dentro do MESMO modal — (1) form simples (nome + grupos
// musculares + objetivo, exatamente os 3 campos pedidos, sem seletor de
// nível: o backend usa "intermediario" como preferência de ordenação, não
// como filtro rígido, então omitir esse campo do form não perde cobertura);
// (2) revisão em lote — o rascunho fica só em memória no frontend (nada
// persistido ainda), o Personal edita/remove livremente, e um clique final
// cria o programa + a sessão + todos os exercícios em sequência, reusando os
// 3 endpoints que já existem (sem endpoint novo de gravação em lote).
type DraftRow = GeneratedExercise & { removed?: boolean };

export function GenerateWorkoutModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "review">("form");
  const [name, setName] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [goal, setGoal] = useState<WorkoutGoal>("hipertrofia");
  const [draft, setDraft] = useState<DraftRow[]>([]);

  const exercisesQuery = useQuery({ queryKey: ["exercises"], queryFn: () => listExercises() });
  const muscleGroups = useMemo(() => {
    const set = new Set((exercisesQuery.data?.exercises ?? []).map((e) => e.muscleGroup));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [exercisesQuery.data]);

  function toggleGroup(group: string) {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }

  const generateMutation = useMutation({
    mutationFn: () => generateWorkoutDraft({ muscleGroups: selectedGroups, goal }),
    onSuccess: (data) => {
      setDraft(data.exercises);
      setStep("review");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = draft.filter((r) => !r.removed);
      const { program } = await createWorkoutProgram(name.trim(), "LETTER");
      const { session } = await addProgramSession(program.id, { letter: "A", name: name.trim() });
      // Sequencial de propósito: cada linha respeita a `order` já atribuída
      // pelo gerador, e reusa o MESMO endpoint de adicionar-um-exercício já
      // usado pelo fluxo manual — sem endpoint novo de gravação em lote.
      let order = 1;
      for (const row of rows) {
        await addWorkoutExercise(session.id, {
          exerciseId: row.exerciseId,
          sets: row.sets,
          repsRange: row.repsRange,
          restSeconds: row.restSeconds,
          order: order++,
        });
      }
      return program;
    },
    onSuccess: (program) => {
      onClose();
      router.push(`/personal/programas/${program.id}`);
    },
  });

  const visibleDraft = draft.filter((r) => !r.removed);

  function updateRow(exerciseId: string, patch: Partial<DraftRow>) {
    setDraft((prev) => prev.map((r) => (r.exerciseId === exerciseId ? { ...r, ...patch } : r)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">⚡ Gerar Treino Rápido</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-sm text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {step === "form" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              generateMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-name">Nome da sessão</Label>
              <Input
                id="generate-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Sessão A - Peito e Tríceps"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Grupos musculares</Label>
              <p className="text-xs text-muted">
                O 1º grupo marcado é o principal (mais exercícios); os demais entram como
                secundários.
              </p>
              {exercisesQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
              {exercisesQuery.isError && (
                <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
              )}
              <div className="flex flex-wrap gap-2">
                {muscleGroups.map((group) => {
                  const index = selectedGroups.indexOf(group);
                  const active = index !== -1;
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleGroup(group)}
                      aria-pressed={active}
                      className={
                        active
                          ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
                          : "rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent"
                      }
                    >
                      {active && index === 0 ? "★ " : ""}
                      {group}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-goal">Objetivo</Label>
              <select
                id="generate-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value as WorkoutGoal)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {generateMutation.isError && (
              <p className="text-sm text-danger">
                {generateMutation.error instanceof ApiError
                  ? generateMutation.error.message
                  : "Não foi possível gerar a sugestão."}
              </p>
            )}

            <Button type="submit" disabled={generateMutation.isPending || selectedGroups.length === 0}>
              {generateMutation.isPending ? "Gerando..." : "Gerar sugestão"}
            </Button>
          </form>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Revise, ajuste ou remova qualquer linha antes de criar — nada foi salvo ainda.
            </p>

            {visibleDraft.length === 0 && (
              <p className="text-sm text-muted">
                Nenhum exercício sobrou nessa sugestão. Volte e tente outros grupos musculares.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {draft.map((row) =>
                row.removed ? null : (
                  <div key={row.exerciseId} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold">{row.exerciseName}</span>
                        <p className="text-xs text-muted">{row.muscleGroup}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateRow(row.exerciseId, { removed: true })}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`sets-${row.exerciseId}`}>Séries</Label>
                        <Input
                          id={`sets-${row.exerciseId}`}
                          type="number"
                          min={1}
                          value={row.sets}
                          onChange={(e) => updateRow(row.exerciseId, { sets: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`reps-${row.exerciseId}`}>Reps</Label>
                        <Input
                          id={`reps-${row.exerciseId}`}
                          value={row.repsRange}
                          onChange={(e) => updateRow(row.exerciseId, { repsRange: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`rest-${row.exerciseId}`}>Descanso (s)</Label>
                        <Input
                          id={`rest-${row.exerciseId}`}
                          type="number"
                          min={0}
                          value={row.restSeconds}
                          onChange={(e) =>
                            updateRow(row.exerciseId, { restSeconds: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {saveMutation.isError && (
              <p className="text-sm text-danger">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : "Não foi possível criar o treino."}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setStep("form")}
                disabled={saveMutation.isPending}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={saveMutation.isPending || visibleDraft.length === 0}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Criando..." : "Criar treino"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
