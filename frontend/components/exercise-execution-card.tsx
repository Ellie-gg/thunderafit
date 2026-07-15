"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSetLog } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { toYoutubeEmbedUrl } from "@/lib/youtube";
import type { WorkoutExercise } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";

export function ExerciseExecutionCard({
  workoutId,
  workoutExercise,
}: {
  workoutId: string;
  workoutExercise: WorkoutExercise;
}) {
  const queryClient = useQueryClient();
  const [repsDone, setRepsDone] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const setLogs = workoutExercise.setLogs ?? [];
  const nextSetNumber = setLogs.length + 1;
  const isComplete = setLogs.length >= workoutExercise.sets;

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

  const embedUrl = workoutExercise.exercise?.mediaUrl
    ? toYoutubeEmbedUrl(workoutExercise.exercise.mediaUrl)
    : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">{workoutExercise.exercise?.name}</h3>
        <span className="font-mono-nums text-xs text-muted">
          {setLogs.length}/{workoutExercise.sets} séries
        </span>
      </div>

      <VoltageBar total={workoutExercise.sets} filled={setLogs.length} />

      {embedUrl && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
          <iframe
            src={embedUrl}
            title={workoutExercise.exercise?.name}
            className="h-full w-full"
            allowFullScreen
          />
        </div>
      )}

      <p className="text-sm text-muted">{workoutExercise.exercise?.description}</p>

      <p className="text-xs text-muted">
        Prescrito: {workoutExercise.sets}x {workoutExercise.repsRange} · descanso{" "}
        {workoutExercise.restSeconds}s
      </p>

      {setLogs.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          {setLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between font-mono-nums text-sm text-foreground"
            >
              <span className="text-muted">Série {log.setNumber}</span>
              <span>
                {log.repsDone} reps × {log.weightKg}kg
              </span>
            </div>
          ))}
        </div>
      )}

      {!isComplete && (
        <form
          className="flex items-end gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-muted">Reps (série {nextSetNumber})</label>
            <Input
              type="number"
              min={0}
              required
              value={repsDone}
              onChange={(e) => setRepsDone(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-muted">Carga (kg)</label>
            <Input
              type="number"
              min={0}
              step="0.5"
              required
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "..." : "Registrar"}
          </Button>
        </form>
      )}

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : "Erro ao registrar série."}
        </p>
      )}
    </Card>
  );
}
