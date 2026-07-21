"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import type { WorkoutCompletionSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PostWorkoutSummaryCard } from "@/components/post-workout-summary-card";

// Fase 35: moldura ao redor do card pós-treino — backdrop + ações de
// compartilhar/baixar/fechar. Segue o mesmo padrão zero-dependência de
// overlay já usado no menu mobile do AppHeader (`fixed inset-0`); não existe
// biblioteca de dialog instalada no projeto e não introduzimos uma só pra
// isso.
export function PostWorkoutSummaryModal({
  summary,
  onClose,
}: {
  summary: WorkoutCompletionSummary;
  onClose: () => void;
}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  // Feature-detect uma única vez: este componente só é montado no cliente
  // (dentro do modal aberto após a mutação de conclusão), nunca no SSR.
  const [canShare] = React.useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
  const [isExporting, setIsExporting] = React.useState(false);

  async function captureImageBlob(): Promise<Blob> {
    if (!cardRef.current) throw new Error("Card não encontrado.");
    await document.fonts?.ready;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function handleDownload() {
    setIsExporting(true);
    try {
      const blob = await captureImageBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `thunderafit-treino-${summary.workoutLetter}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleShare() {
    setIsExporting(true);
    try {
      const blob = await captureImageBlob();
      const file = new File([blob], "treino.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Meu treino no ThunderaFit" });
      } else {
        await handleDownload();
      }
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-xs flex-col gap-4">
        <PostWorkoutSummaryCard ref={cardRef} summary={summary} />
        <div className="flex gap-2">
          {canShare && (
            <Button onClick={handleShare} disabled={isExporting} className="flex-1">
              Compartilhar
            </Button>
          )}
          <Button onClick={handleDownload} disabled={isExporting} variant="secondary" className="flex-1">
            Baixar imagem
          </Button>
          <Button onClick={onClose} variant="ghost">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
