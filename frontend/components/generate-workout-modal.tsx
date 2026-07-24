"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import type { SessionScheme } from "@/lib/types";
import { orderFor, labelFor } from "@/lib/session-scheme";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

const GOAL_VALUES: WorkoutGoal[] = ["hipertrofia", "forca", "resistencia"];

type DraftRow = GeneratedExercise & { removed?: boolean };
type CompletedSession = { key: string; exercises: DraftRow[] };

/**
 * "Montagem Inteligente": gera o PROGRAMA inteiro (todas as sessões do
 * esquema escolhido), não uma sessão avulsa — correção de escopo depois do
 * primeiro rascunho desta feature, que só gerava a sessão do dia. Fluxo:
 * (1) setup — nome do programa, esquema (Letras/Dias) e objetivo, este
 * último fixo pra todas as sessões geradas; (2) por sessão — grupos
 * musculares só daquela sessão, gera/revisa/edita, e então "Próximo treino"
 * (avança pra próxima letra/dia da sequência) ou "Salvar programa de
 * treinamento" (persiste tudo que já foi montado até aqui, mesmo que não
 * tenha passado por todas as sessões do esquema). Nada é persistido até o
 * "Salvar" final — reusa os mesmos 3 endpoints já existentes, sem endpoint
 * novo de gravação em lote.
 */
export function GenerateWorkoutModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("generateWorkoutModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "session">("setup");

  // --- Setup: nome, esquema, objetivo — fixos pro programa inteiro. ---
  const [programName, setProgramName] = useState("");
  const [scheme, setScheme] = useState<SessionScheme>("LETTER");
  const [goal, setGoal] = useState<WorkoutGoal>("hipertrofia");

  // --- Progresso pela sequência de sessões (A→E ou Segunda→Domingo). ---
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [currentDraft, setCurrentDraft] = useState<DraftRow[] | null>(null);

  const keys = orderFor(scheme);
  const currentKey = keys[currentKeyIndex];
  const isLastKey = currentKeyIndex === keys.length - 1;
  const doneKeys = new Set(completedSessions.map((s) => s.key));

  // staleTime alto: mesmo catálogo estático de add-exercise-form.tsx — reusa
  // o cache entre os dois em vez de refazer o fetch a cada abertura do modal.
  const exercisesQuery = useQuery({
    queryKey: ["exercises"],
    queryFn: () => listExercises(),
    staleTime: 5 * 60_000,
  });
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
    onSuccess: (data) => setCurrentDraft(data.exercises),
  });

  /** Inclui a sessão ATUAL (se já foi gerada/pulada) na lista final, sem duplicar. */
  function sessionsIncludingCurrent(): CompletedSession[] {
    if (currentDraft === null) return completedSessions;
    return [...completedSessions, { key: currentKey, exercises: currentDraft }];
  }

  function goToNextSession() {
    setCompletedSessions(sessionsIncludingCurrent());
    setCurrentKeyIndex((i) => i + 1);
    setSelectedGroups([]);
    setCurrentDraft(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSessions = sessionsIncludingCurrent();
      const { program } = await createWorkoutProgram(programName.trim(), scheme);
      // Sequencial de propósito: reusa os mesmos endpoints do fluxo manual
      // (criar sessão, depois adicionar exercício a exercício), sem endpoint
      // novo de gravação em lote.
      for (const s of finalSessions) {
        const { session } = await addProgramSession(program.id, { letter: s.key });
        let order = 1;
        for (const row of s.exercises.filter((r) => !r.removed)) {
          await addWorkoutExercise(session.id, {
            exerciseId: row.exerciseId,
            sets: row.sets,
            repsRange: row.repsRange,
            restSeconds: row.restSeconds,
            order: order++,
          });
        }
      }
      return program;
    },
    onSuccess: (program) => {
      onClose();
      router.push(`/personal/programas/${program.id}`);
    },
  });

  function updateRow(exerciseId: string, patch: Partial<DraftRow>) {
    setCurrentDraft((prev) =>
      prev ? prev.map((r) => (r.exerciseId === exerciseId ? { ...r, ...patch } : r)) : prev
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("modalTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeAriaLabel")}
            className="text-sm text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {step === "setup" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setStep("session");
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-program-name">{t("programNameLabel")}</Label>
              <Input
                id="generate-program-name"
                required
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder={t("programNamePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("sessionSchemeLabel")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scheme === "LETTER" ? "default" : "secondary"}
                  onClick={() => setScheme("LETTER")}
                  className="flex-1"
                >
                  {t("letterScheme")}
                </Button>
                <Button
                  type="button"
                  variant={scheme === "WEEKDAY" ? "default" : "secondary"}
                  onClick={() => setScheme("WEEKDAY")}
                  className="flex-1"
                >
                  {t("weekdayScheme")}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="generate-goal">{t("goalLabel")}</Label>
              <select
                id="generate-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value as WorkoutGoal)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {GOAL_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(`goals.${value}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">{t("goalHint")}</p>
            </div>

            <Button type="submit" disabled={!programName.trim()}>
              {t("advance")}
            </Button>
          </form>
        )}

        {step === "session" && (
          <div className="flex flex-col gap-4">
            {/* Progresso pela sequência — pílula preenchida = sessão já montada. */}
            <div className="flex flex-wrap gap-1.5">
              {keys.map((key, index) => (
                <span
                  key={key}
                  className={
                    doneKeys.has(key)
                      ? "rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent"
                      : index === currentKeyIndex
                        ? "rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent"
                        : "rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                  }
                >
                  {labelFor(scheme, key)}
                </span>
              ))}
            </div>

            <h3 className="font-display text-base font-bold">
              {t("sessionTitle", { label: labelFor(scheme, currentKey) })}
            </h3>

            {currentDraft === null ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("muscleGroupsLabel")}</Label>
                  <p className="text-xs text-muted">{t("muscleGroupsHint")}</p>
                  {exercisesQuery.isLoading && (
                    <p className="text-sm text-muted">{tCommon("loading")}</p>
                  )}
                  {exercisesQuery.isError && (
                    <QueryError
                      error={exercisesQuery.error}
                      onRetry={() => exercisesQuery.refetch()}
                    />
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

                {generateMutation.isError && (
                  <p className="text-sm text-danger">
                    {generateMutation.error instanceof ApiError
                      ? generateMutation.error.message
                      : t("generateError")}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={generateMutation.isPending || selectedGroups.length === 0}
                    onClick={() => generateMutation.mutate()}
                  >
                    {generateMutation.isPending ? t("generating") : t("generateSuggestion")}
                  </Button>
                  {/* Pular: cria esta sessão sem exercício nenhum (o Personal
                      adiciona depois manualmente, mesmo padrão do fluxo comum). */}
                  <Button type="button" variant="secondary" onClick={() => setCurrentDraft([])}>
                    {t("skipSession")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">{t("reviewHint")}</p>

                {currentDraft.filter((r) => !r.removed).length === 0 && (
                  <p className="text-sm text-muted">{t("noExercisesSkipped")}</p>
                )}

                <div className="flex flex-col gap-3">
                  {currentDraft
                    .filter((r) => !r.removed)
                    .map((row) => (
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
                            {t("removeRow")}
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor={`sets-${row.exerciseId}`}>{t("setsLabel")}</Label>
                            <Input
                              id={`sets-${row.exerciseId}`}
                              type="number"
                              min={1}
                              value={row.sets}
                              onChange={(e) =>
                                updateRow(row.exerciseId, { sets: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor={`reps-${row.exerciseId}`}>{t("repsLabel")}</Label>
                            <Input
                              id={`reps-${row.exerciseId}`}
                              value={row.repsRange}
                              onChange={(e) =>
                                updateRow(row.exerciseId, { repsRange: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor={`rest-${row.exerciseId}`}>{t("restLabel")}</Label>
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
                    ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentDraft(null)}
                  className="self-start text-xs font-semibold text-accent-secondary hover:underline"
                >
                  {t("adjustGroups")}
                </button>
              </>
            )}

            {saveMutation.isError && (
              <p className="text-sm text-danger">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : t("saveError")}
              </p>
            )}

            <div className="flex gap-2 border-t border-border pt-4">
              {!isLastKey && (
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={currentDraft === null || saveMutation.isPending}
                  onClick={goToNextSession}
                >
                  {t("nextWorkout")}
                </Button>
              )}
              <Button
                type="button"
                className="flex-1"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? t("saving") : t("saveProgram")}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
