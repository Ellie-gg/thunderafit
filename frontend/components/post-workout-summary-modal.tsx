"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { WorkoutCompletionSummary } from "@/lib/types";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PostWorkoutSummaryCard } from "@/components/post-workout-summary-card";
import { RpeQuickPicker } from "@/components/rpe-quick-picker";

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
  const t = useTranslations("postWorkoutSummaryModal");
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
  // B5: erro do download precisa ser visível — antes falhava em silêncio.
  const [downloadError, setDownloadError] = React.useState(false);

  async function captureImageDataUrl(): Promise<string> {
    if (!cardRef.current) throw new Error("Card não encontrado.");
    await document.fonts?.ready;
    return toPng(cardRef.current, { pixelRatio: 3 });
  }

  /**
   * B5 (auditoria 2026-08-06): devolve `boolean` e trata o próprio erro em vez
   * de propagar. Antes era `try/finally` SEM `catch`: se a captura (`toPng`,
   * `pixelRatio: 3`) falhasse, o botão piscava desabilitado e voltava ao
   * normal — sem download e sem nenhuma mensagem. Pior, o `catch` de
   * `handleShare` chama esta função como plano B; a rejeição escapava do
   * `finally` como unhandled rejection e o aluno via "não foi possível
   * compartilhar" sem receber o download prometido.
   */
  async function handleDownload(): Promise<boolean> {
    setIsExporting(true);
    setDownloadError(false);
    try {
      const dataUrl = await captureImageDataUrl();
      const blob = await (await fetch(dataUrl)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `thunderafit-treino-${summary.workoutLetter}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      return true;
    } catch {
      setDownloadError(true);
      return false;
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
    await Share.share({ files: [uri], dialogTitle: t("shareDialogTitle") });
  }

  async function shareWeb(dataUrl: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "treino.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: t("shareTitle") });
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
      //
      // B5 (auditoria 2026-08-06): `handleDownload` agora trata o próprio erro
      // e devolve boolean, então a rejeição não escapa mais como unhandled —
      // e só afirmamos "baixamos a imagem pra você" (`shareErrorMessage`)
      // quando o download REALMENTE aconteceu. Se ele também falhar, o
      // `downloadErrorMessage` aparece em vez de uma promessa falsa.
      const baixou = await handleDownload();
      setShareError(baixou);
    } finally {
      setIsExporting(false);
    }
  }

  // A1 (auditoria 2026-08-06): no overlay abaixo, `overflow-y-auto` +
  // `items-start` são load-bearing, não cosmética. O card é `aspect-[9/16]`
  // (altura FIXA, ~569px num `max-w-xs`) e a Fase 112 inseriu o
  // RpeQuickPicker (~168px) entre ele e os botões — o conteúdo passou de
  // 880px. Sem rolagem, em iPhone SE (375×667), 360×640 e 320×568 os botões
  // "Compartilhar", "Baixar imagem" e "Fechar" caíam FORA da viewport, num
  // overlay `fixed` que não rolava: não havia como fechar, compartilhar nem
  // baixar (só recarregar a página, perdendo o resumo). `items-center`
  // centraliza mas também impede alcançar o que transborda pra cima, por isso
  // virou `items-start` com `my-auto` no filho — continua centrado quando
  // cabe, e rola quando não cabe.
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 p-4">
      <div className="my-auto flex w-full max-w-xs flex-col gap-4">
        <PostWorkoutSummaryCard
          ref={cardRef}
          summary={summary}
          alunoName={alunoName}
          durationSeconds={durationSeconds}
        />
        {/* Fase 112: fora do `cardRef` de propósito — não deve entrar na
            imagem exportada/compartilhada. `sessionLogId` só existe quando o
            backend já persistiu o WorkoutSessionLog (sempre, num client
            atualizado); sem ele, simplesmente não oferece a pergunta. */}
        {summary.sessionLogId && <RpeQuickPicker sessionLogId={summary.sessionLogId} />}
        {shareError && (
          <p className="text-sm text-danger">
            {t("shareErrorMessage")}
          </p>
        )}
        {/* B5: sem isto o "Baixar imagem" falhava sem dizer nada. */}
        {downloadError && (
          <p className="text-sm text-danger">
            {t("downloadErrorMessage")}
          </p>
        )}
        {/* Fr9 (auditoria 2026-07-31): 3 botões numa linha só (`whitespace-nowrap`
            + `px-5` em cada, nunca encolhem) precisavam de ~375px — num
            iPhone SE (375px) ou Android de 320px o "Fechar" saía da tela
            (overlay `fixed`, sem como rolar até ele). `flex-wrap` deixa
            Compartilhar/Baixar na 1ª linha e Fechar cai pra 2ª quando não
            cabe, em vez de vazar horizontalmente. */}
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <Button onClick={handleShare} disabled={isExporting} className="flex-1">
              {t("shareButton")}
            </Button>
          )}
          <Button onClick={handleDownload} disabled={isExporting} variant="secondary" className="flex-1">
            {t("downloadButton")}
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full">
            {t("closeButton")}
          </Button>
        </div>
        {upsell}
      </div>
    </div>
  );
}
