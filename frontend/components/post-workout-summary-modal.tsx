"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { WorkoutCompletionSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PostWorkoutSummaryCard } from "@/components/post-workout-summary-card";

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

// Fase 35/37: moldura ao redor do card pós-treino — backdrop + ações de
// compartilhar/baixar/fechar. Segue o mesmo padrão zero-dependência de
// overlay já usado no menu mobile do AppHeader (`fixed inset-0`); não existe
// biblioteca de dialog instalada no projeto e não introduzimos uma só pra
// isso.
//
// Compartilhamento é UM botão só, que decide por baixo dos panos qual
// mecanismo usar (não um botão "Compartilhar no Instagram" separado): dentro
// do app Capacitor (`Capacitor.isNativePlatform()`) usa o share sheet nativo
// via `@capacitor/share` (grava o PNG num arquivo temporário com
// `@capacitor/filesystem` primeiro, já que o plugin de share só aceita
// `file://` URIs, não blob: URLs) — o Instagram aparece como opção nessa
// lista se estiver instalado, sem precisar de OAuth/API key. Não há
// tratamento de "Instagram não instalado" porque o share sheet genérico já
// lida com isso sozinho: se o app não estiver lá, ele simplesmente não
// aparece na lista, sem erro. Fora do Capacitor (web/mobile browser), usa a
// Web Share API como já fazia. Os dois ambientes nunca coexistem
// (`navigator.share` não existe dentro do WebView do Capacitor), então não
// há ambiguidade de qual caminho roda.
export function PostWorkoutSummaryModal({
  summary,
  alunoName,
  durationSeconds,
  upsell,
  onClose,
}: {
  summary: WorkoutCompletionSummary;
  alunoName: string;
  durationSeconds: number | null;
  /** Fase 34.5: CTA opcional (ex: "convide um Personal") pra treinos "Meu treino pessoal". */
  upsell?: React.ReactNode;
  onClose: () => void;
}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  // Feature-detect uma única vez: este componente só é montado no cliente
  // (dentro do modal aberto após a mutação de conclusão), nunca no SSR.
  const [isNative] = React.useState(() => Capacitor.isNativePlatform());
  const [canWebShare] = React.useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
  const canShare = isNative || canWebShare;
  const [isExporting, setIsExporting] = React.useState(false);
  const [shareError, setShareError] = React.useState(false);

  async function captureImageDataUrl(): Promise<string> {
    if (!cardRef.current) throw new Error("Card não encontrado.");
    await document.fonts?.ready;
    return toPng(cardRef.current, { pixelRatio: 3 });
  }

  async function handleDownload() {
    setIsExporting(true);
    try {
      const dataUrl = await captureImageDataUrl();
      const blob = await (await fetch(dataUrl)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `thunderafit-treino-${summary.workoutLetter}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setIsExporting(false);
    }
  }

  async function shareNative(dataUrl: string) {
    const fileName = `thunderafit-treino-${summary.workoutLetter}-${Date.now()}.png`;
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: dataUrlToBase64(dataUrl),
      directory: Directory.Cache,
    });
    await Share.share({ files: [uri], dialogTitle: "Compartilhar treino" });
  }

  async function shareWeb(dataUrl: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "treino.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Meu treino no ThunderaFit" });
    } else {
      await handleDownload();
    }
  }

  async function handleShare() {
    setIsExporting(true);
    setShareError(false);
    try {
      const dataUrl = await captureImageDataUrl();
      if (isNative) {
        await shareNative(dataUrl);
      } else {
        await shareWeb(dataUrl);
      }
    } catch {
      // Falha real (ex: erro ao gravar o arquivo temporário) — não um
      // simples cancelamento do share sheet pelo usuário. Oferece o download
      // como alternativa amigável, igual já acontecia quando não havia
      // nenhum mecanismo de share disponível.
      setShareError(true);
      await handleDownload();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-xs flex-col gap-4">
        <PostWorkoutSummaryCard
          ref={cardRef}
          summary={summary}
          alunoName={alunoName}
          durationSeconds={durationSeconds}
        />
        {shareError && (
          <p className="text-sm text-danger">
            Não foi possível compartilhar direto — baixamos a imagem pra você anexar manualmente.
          </p>
        )}
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
        {upsell}
      </div>
    </div>
  );
}
