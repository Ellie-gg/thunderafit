"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toYoutubeEmbedUrl, toYoutubeThumbnail } from "@/lib/youtube";
import type { WorkoutExercise } from "@/lib/types";
import { Card } from "@/components/ui/card";

/**
 * Fase 65 — "Ver como o aluno vê": o Personal só tinha a lista de edição
 * (nome + sets/reps numa linha só) pra conferir o que prescreveu. Este card
 * reaproveita a MESMA parte visual/de mídia de `ExerciseExecutionCard` (nome,
 * vídeo/gif de demonstração, descrição, prescrição, observação) mas
 * deliberadamente SEM nada interativo que grave dado do aluno — sem
 * checkbox de concluído, sem `VoltageBar` de séries, sem formulário de
 * registrar série. Puro preview, somente leitura (decisão do fundador:
 * "modo leitura, só visual", não o progresso real do aluno).
 */
export function ExercisePreviewCard({ workoutExercise }: { workoutExercise: WorkoutExercise }) {
  const t = useTranslations("exerciseExecutionCard");
  const [playing, setPlaying] = useState(false);

  const mediaUrl = workoutExercise.exercise?.mediaUrl ?? null;
  const mediaType = workoutExercise.exercise?.mediaType ?? "YOUTUBE";
  const embedUrl = mediaType === "YOUTUBE" && mediaUrl ? toYoutubeEmbedUrl(mediaUrl) : null;
  const thumbnailUrl = mediaType === "YOUTUBE" && mediaUrl ? toYoutubeThumbnail(mediaUrl) : null;

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-bold">{workoutExercise.exercise?.name}</h3>

      {mediaType === "VIDEO" && mediaUrl ? (
        <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
          <video src={mediaUrl} autoPlay loop muted playsInline className="aspect-video w-full object-cover" />
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

      {workoutExercise.notes && (
        <p className="rounded-md border border-accent-secondary/30 bg-accent-secondary/10 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold text-accent-secondary">{t("personalNoteLabel")}</span>
          {workoutExercise.notes}
        </p>
      )}
    </Card>
  );
}
