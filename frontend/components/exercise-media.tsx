"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toYoutubeEmbedUrl, toYoutubeThumbnail } from "@/lib/youtube";
import type { Exercise } from "@/lib/types";

/**
 * Fase 84 — extraído de `ExerciseExecutionCard`/`ExercisePreviewCard`, que
 * tinham o mesmo bloco de renderização de mídia duplicado (Fase 65 já
 * reaproveitava por comentário, mas não por código). Ganha aqui o
 * botãozinho de link suplementar do YouTube (`youtubeSupplementUrl`) por
 * cima do vídeo/GIF próprio — um lugar só, os dois cards ganham de graça.
 */
export function ExerciseMedia({ exercise }: { exercise: Exercise | null | undefined }) {
  const t = useTranslations("exerciseExecutionCard");
  const [playing, setPlaying] = useState(false);

  const mediaUrl = exercise?.mediaUrl ?? null;
  const mediaType = exercise?.mediaType ?? "YOUTUBE";
  const youtubeSupplementUrl = exercise?.youtubeSupplementUrl ?? null;
  const embedUrl = mediaType === "YOUTUBE" && mediaUrl ? toYoutubeEmbedUrl(mediaUrl) : null;
  const thumbnailUrl = mediaType === "YOUTUBE" && mediaUrl ? toYoutubeThumbnail(mediaUrl) : null;
  const exerciseName = exercise?.name ?? t("genericExercise");

  // Só faz sentido quando a mídia principal é um vídeo/GIF PRÓPRIO — quando
  // é YOUTUBE, o mediaUrl já É o link do YouTube, o badge duplicaria a
  // mesma informação (por isso o backend nem deixa esse campo sobreviver
  // quando mediaType volta a ser YOUTUBE, ver admin.service.ts).
  const supplementBadge =
    (mediaType === "VIDEO" || mediaType === "GIF") && youtubeSupplementUrl ? (
      <a
        href={youtubeSupplementUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("youtubeSupplementAriaLabel", { name: exerciseName })}
        title={t("youtubeSupplementAriaLabel", { name: exerciseName })}
        className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow-md ring-2 ring-black/20 transition-transform hover:scale-110"
      >
        <span aria-hidden className="text-[10px] leading-none">
          ▶
        </span>
      </a>
    ) : null;

  if (mediaType === "VIDEO" && mediaUrl) {
    return (
      <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border">
        {/* Replica a UX de GIF (autoplay em loop, sem som) num container de
            aspect-ratio fixo, não fullscreen — decisão da Fase 32: GIF de
            verdade infla um clipe H.264 de ~900KB pra 5-12MB. */}
        <video src={mediaUrl} autoPlay loop muted playsInline className="aspect-video w-full object-cover" />
        {supplementBadge}
      </div>
    );
  }

  if (mediaType === "GIF" && mediaUrl) {
    return (
      <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={t("demoAlt", { name: exerciseName })}
          loading="lazy"
          className="w-full"
        />
        {supplementBadge}
      </div>
    );
  }

  if (embedUrl) {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border">
        <div className="relative aspect-video">
          {playing ? (
            <iframe
              src={`${embedUrl}?autoplay=1`}
              title={exerciseName}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={t("playVideoAriaLabel", { name: exerciseName })}
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
    );
  }

  if (mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-accent-secondary hover:underline"
      >
        {t("viewDemoOnYoutube")}
      </a>
    );
  }

  return null;
}
