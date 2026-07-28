"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSetLog } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { splitSetLogsBySessionBoundary } from "@/lib/utils";
import type { WorkoutExercise } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { ExerciseMedia } from "@/components/exercise-media";

export function ExerciseExecutionCard({
  workoutId,
  workoutExercise,
  sessionBoundary,
  id,
  onMarkDone,
}: {
  workoutId: string;
  workoutExercise: WorkoutExercise;
  /**
   * Fase 40: `Workout.lastCompletedAt` de ANTES desta sessão (null na
   * primeiríssima vez) — separa as séries desta sessão das de ciclos
   * anteriores, já que o mesmo `WorkoutExercise` é reaberto toda semana e
   * `setLogs` traz o histórico inteiro, não só o de hoje.
   */
  sessionBoundary: string | null;
  /** id do elemento raiz — usado pelo container pra rolar até o próximo card. */
  id?: string;
  /** Fase 33.1: disparado ao marcar/desmarcar o checkbox "Concluído". */
  onMarkDone?: (done: boolean) => void;
}) {
  const t = useTranslations("exerciseExecutionCard");
  const queryClient = useQueryClient();
  const [repsDone, setRepsDone] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);
  // Fase 33.1: marca manual do aluno, independente de isComplete — é o aluno
  // quem decide que terminou o exercício, mesmo sem ter registrado todas as
  // séries. Só um assistente de navegação (esmaece + avisa o pai pra rolar
  // até o próximo card); não persiste no backend nem afeta setLogs/sets.
  const [markedDone, setMarkedDone] = useState(false);

  const { thisSession: setLogs, previous: previousSetLogs } = splitSetLogsBySessionBoundary(
    workoutExercise.setLogs ?? [],
    sessionBoundary
  );
  const nextSetNumber = setLogs.length + 1;
  const isComplete = setLogs.length >= workoutExercise.sets;
  // Referência pequena "da última vez" pra este número de série específico —
  // pega o registro mais recente (ordenado asc, então o último match) de um
  // ciclo anterior, sem poluir a tela com todo o histórico.
  const lastTimeSameSet = [...previousSetLogs].reverse().find((l) => l.setNumber === nextSetNumber);

  const mutation = useMutation({
    mutationFn: () =>
      createSetLog(workoutId, workoutExercise.id, {
        setNumber: nextSetNumber,
        repsDone: Number(repsDone),
        weightKg: Number(weightKg),
      }),
    onSuccess: () => {
      setRepsDone("");
      setWeightKg("");
      queryClient.invalidateQueries({ queryKey: ["workout", workoutId] });
    },
  });

  return (
    <Card
      id={id}
      className={`flex flex-col gap-4 transition-opacity duration-300 ${markedDone ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={markedDone}
            onChange={(e) => {
              const done = e.target.checked;
              setMarkedDone(done);
              onMarkDone?.(done);
            }}
            aria-label={t("markAsDoneAriaLabel", {
              name: workoutExercise.exercise?.name ?? t("genericExercise"),
            })}
            className="h-5 w-5 shrink-0 rounded border-border accent-accent"
          />
          <h3 className="font-display text-lg font-bold">{workoutExercise.exercise?.name}</h3>
        </label>
        <span className="font-mono-nums shrink-0 text-xs text-muted">
          {t("setsCount", { done: setLogs.length, total: workoutExercise.sets })}
        </span>
      </div>

      <VoltageBar total={workoutExercise.sets} filled={setLogs.length} role="ALUNO" />

      {/* Player responsivo (Fase 17, Item 3): largura limitada (max-w-sm) para
          não dominar a tela; começa como thumbnail-com-play e só carrega o
          iframe ao clicar. Quando a mídia não é um vídeo embedável (ex: URLs
          de BUSCA do YouTube dos exercícios da Fase 15), cai num link.
          Fase 32: VIDEO/GIF são arquivos nativos do bucket — sem necessidade
          de thumbnail-com-play, tocam/exibem direto. Fase 84: extraído pra
          `ExerciseMedia` (compartilhado com `ExercisePreviewCard`), que
          também cuida do botãozinho de link suplementar do YouTube. */}
      <ExerciseMedia exercise={workoutExercise.exercise} />

      <p className="text-sm text-muted">{workoutExercise.exercise?.description}</p>

      <p className="text-xs text-muted">
        {t("prescribedInfo", {
          sets: workoutExercise.sets,
          repsRange: workoutExercise.repsRange,
          restSeconds: workoutExercise.restSeconds,
        })}
      </p>

      {/* Fase 27: observação do Personal sobre esta prescrição específica —
          diferente da descrição do catálogo acima. */}
      {workoutExercise.notes && (
        <p className="rounded-md border border-accent-secondary/30 bg-accent-secondary/10 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold text-accent-secondary">{t("personalNoteLabel")}</span>
          {workoutExercise.notes}
        </p>
      )}

      {setLogs.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          {setLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between font-mono-nums text-sm text-foreground"
            >
              <span className="text-muted">{t("setLabel", { number: log.setNumber })}</span>
              <span>{t("repsWeight", { reps: log.repsDone, weight: log.weightKg })}</span>
            </div>
          ))}
        </div>
      )}

      {!isComplete && (
        <form
          className="flex flex-col gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {/* Fase 40: referência bem discreta da última vez que este MESMO
              número de série foi feito — só uma linha pequena, sem gráfico
              nem card extra, pra não poluir. Some quando não há registro
              anterior pra esse número (exercício novo, ou 1ª sessão). */}
          {lastTimeSameSet && (
            <p className="text-xs text-muted">
              {t("lastTime", { reps: lastTimeSameSet.repsDone, weight: lastTimeSameSet.weightKg })}
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-muted">{t("repsLabel", { number: nextSetNumber })}</label>
              <Input
                type="number"
                min={0}
                max={99}
                required
                value={repsDone}
                onChange={(e) => {
                  // Fase 38: ninguém faz mais de 99 reps numa série — 2 dígitos
                  // é o teto (também evita o campo crescer feio na tela). Ao
                  // completar 2 dígitos, pula o foco pro campo de carga
                  // seguinte, sem precisar tocar em Tab/Próximo.
                  const next = e.target.value.slice(0, 2);
                  setRepsDone(next);
                  if (next.length === 2) {
                    weightInputRef.current?.focus();
                  }
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-muted">{t("loadLabel")}</label>
              <Input
                type="number"
                min={0}
                step="0.5"
                required
                ref={weightInputRef}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("registering") : t("registerButton")}
            </Button>
          </div>
        </form>
      )}

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : t("registerError")}
        </p>
      )}
    </Card>
  );
}
