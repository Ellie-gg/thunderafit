"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSetLog } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { toYoutubeEmbedUrl, toYoutubeThumbnail } from "@/lib/youtube";
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
  const [playing, setPlaying] = useState(false);

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

  const mediaUrl = workoutExercise.exercise?.mediaUrl ?? null;
  const embedUrl = mediaUrl ? toYoutubeEmbedUrl(mediaUrl) : null;
  const thumbnailUrl = mediaUrl ? toYoutubeThumbnail(mediaUrl) : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">{workoutExercise.exercise?.name}</h3>
        <span className="font-mono-nums text-xs text-muted">
          {setLogs.length}/{workoutExercise.sets} séries
        </span>
      </div>

      <VoltageBar total={workoutExercise.sets} filled={setLogs.length} role="ALUNO" />

      {/* Player responsivo (Fase 17, Item 3): largura limitada (max-w-sm) para
          não dominar a tela; começa como thumbnail-com-play e só carrega o
          iframe ao clicar. Quando a mídia não é um vídeo embedável (ex: URLs
          de BUSCA do YouTube dos exercícios da Fase 15), cai num link. */}
      {embedUrl ? (
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
          <div className="relative aspect-video">
            {playing ? (
              <iframe
                src={`${embedUrl}?autoplay=1`}
                title={workoutExercise.exercise?.name}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`Reproduzir vídeo de ${workoutExercise.exercise?.name ?? "exercício"}`}
                className="group absolute inset-0 h-full w-full"
              >
                {thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-xl text-ink-950">
                    ▶
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      ) : (
        mediaUrl && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-accent-secondary hover:underline"
          >
            ▶ Ver vídeo de demonstração no YouTube
          </a>
        )
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
