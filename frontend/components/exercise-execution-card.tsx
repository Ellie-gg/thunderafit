"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSetLog } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { toYoutubeEmbedUrl, toYoutubeThumbnail } from "@/lib/youtube";
import { splitSetLogsBySessionBoundary } from "@/lib/utils";
import type { WorkoutExercise } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";

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
  const [playing, setPlaying] = useState(false);
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

  const mediaUrl = workoutExercise.exercise?.mediaUrl ?? null;
  const mediaType = workoutExercise.exercise?.mediaType ?? "YOUTUBE";
  const embedUrl = mediaType === "YOUTUBE" && mediaUrl ? toYoutubeEmbedUrl(mediaUrl) : null;
  const thumbnailUrl = mediaType === "YOUTUBE" && mediaUrl ? toYoutubeThumbnail(mediaUrl) : null;

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
          de thumbnail-com-play, tocam/exibem direto. */}
      {mediaType === "VIDEO" && mediaUrl ? (
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
          {/* Replica a UX de GIF (autoplay em loop, sem som) num container
              de aspect-ratio fixo, não fullscreen — decisão da Fase 32:
              GIF de verdade infla um clipe H.264 de ~900KB pra 5-12MB. */}
          <video
            src={mediaUrl}
            autoPlay
            loop
            muted
            playsInline
            className="aspect-video w-full object-cover"
          />
        </div>
      ) : mediaType === "GIF" && mediaUrl ? (
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={t("demoAlt", { name: workoutExercise.exercise?.name ?? t("genericExercise") })}
            loading="lazy"
            className="w-full"
          />
        </div>
      ) : embedUrl ? (
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
          <div className="relative aspect-video">
            {playing ? (
              <iframe
                src={`${embedUrl}?autoplay=1`}
                title={workoutExercise.exercise?.name}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={t("playVideoAriaLabel", {
                  name: workoutExercise.exercise?.name ?? t("genericExercise"),
                })}
                className="group absolute inset-0 h-full w-full"
              >
                {thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
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
            {t("viewDemoOnYoutube")}
          </a>
        )
      )}

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
