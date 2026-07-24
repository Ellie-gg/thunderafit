"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { uploadAdminSelfTemplateBanner } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

// Fase 52: banner do carrossel de "Meu Treino Pessoal" — 16:9, grande o
// bastante pra não borrar num card largo, mas ainda pequeno o suficiente pra
// caber como data URI numa coluna de texto (o backend valida de novo, ~4MB).
const BANNER_WIDTH_PX = 1200;
const BANNER_HEIGHT_PX = 675;
const IMAGE_QUALITY = 0.85;

/**
 * Redimensiona a imagem escolhida pra um retângulo 16:9 de BANNER_WIDTH_PX x
 * BANNER_HEIGHT_PX, inteiramente no navegador (canvas) — SEM recortar nada
 * do original (achado real: a versão anterior fazia center-crop tipo
 * "cover", cortando as bordas de qualquer foto que não fosse já 16:9, o que
 * o fundador reportou como "não mostra completamente a imagem"). A imagem
 * inteira é desenhada em "contain" (encaixada, nunca cortada) centralizada
 * sobre um fundo desfocado/escurecido da MESMA imagem esticada pra preencher
 * o quadro (mesma técnica de capa do Instagram Stories/YouTube) — evita
 * barras pretas lisas sem nunca perder conteúdo da foto original.
 */
async function resizeImageToBannerDataUrl(file: File, t: (key: string) => string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(t("errors.invalidType"));
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(t("errors.loadFailed")));
      el.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = BANNER_WIDTH_PX;
    canvas.height = BANNER_HEIGHT_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t("errors.canvasFailed"));

    const targetRatio = BANNER_WIDTH_PX / BANNER_HEIGHT_PX;
    const srcRatio = img.naturalWidth / img.naturalHeight;

    // Camada de fundo: preenche o quadro inteiro (mesma lógica de "cover" de
    // antes), só que desfocada/escurecida — decorativa, não é onde o
    // conteúdo real da foto precisa ficar visível.
    let bgWidth = img.naturalWidth;
    let bgHeight = img.naturalHeight;
    if (srcRatio > targetRatio) {
      bgWidth = Math.round(img.naturalHeight * targetRatio);
    } else {
      bgHeight = Math.round(img.naturalWidth / targetRatio);
    }
    const bgSx = Math.round((img.naturalWidth - bgWidth) / 2);
    const bgSy = Math.round((img.naturalHeight - bgHeight) / 2);
    ctx.save();
    // ctx.filter pode não existir em navegadores muito antigos — nesse caso
    // o fundo só fica sem blur/escurecido (ainda preenchido, nunca quebra).
    if ("filter" in ctx) {
      ctx.filter = "blur(24px) brightness(0.55)";
    }
    ctx.drawImage(img, bgSx, bgSy, bgWidth, bgHeight, -20, -20, BANNER_WIDTH_PX + 40, BANNER_HEIGHT_PX + 40);
    ctx.restore();

    // Camada principal: a imagem INTEIRA ("contain"), sem cortar nada,
    // centralizada por cima do fundo.
    let drawWidth = BANNER_WIDTH_PX;
    let drawHeight = BANNER_HEIGHT_PX;
    if (srcRatio > targetRatio) {
      drawHeight = Math.round(BANNER_WIDTH_PX / srcRatio);
    } else {
      drawWidth = Math.round(BANNER_HEIGHT_PX * srcRatio);
    }
    const dx = Math.round((BANNER_WIDTH_PX - drawWidth) / 2);
    const dy = Math.round((BANNER_HEIGHT_PX - drawHeight) / 2);
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, drawWidth, drawHeight);

    const dataUrl = canvas.toDataURL("image/webp", IMAGE_QUALITY);
    // Alguns navegadores antigos ignoram "image/webp" e devolvem PNG (bem
    // maior) sem avisar — nesse caso cai pra JPEG, que comprime melhor que PNG.
    if (!dataUrl.startsWith("data:image/webp")) {
      return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Fase 52: banner (16:9) de um template SELF, usado pelos carrosséis de
 * "Meu Treino Pessoal" agrupados por categoria. Componente auto-contido —
 * não conhece a query da listagem de templates, só reporta sucesso pro pai
 * via `onUpdated` (mesmo padrão de `AddExerciseForm.onAdded`), deixando a
 * decisão de invalidar/refetch pra tela que o usa.
 */
export function TemplateBannerUpload({
  programId,
  currentBannerUrl,
  onUpdated,
}: {
  programId: string;
  currentBannerUrl: string | null;
  onUpdated: (bannerUrl: string | null) => void;
}) {
  const t = useTranslations("templateBannerUpload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (bannerDataUrl: string | null) =>
      uploadAdminSelfTemplateBanner(programId, bannerDataUrl),
    onSuccess: (data) => {
      setLocalError(null);
      onUpdated(data.program.bannerImageUrl);
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;

    setLocalError(null);
    try {
      const dataUrl = await resizeImageToBannerDataUrl(file, t);
      mutation.mutate(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("errors.processError"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {currentBannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentBannerUrl}
          alt=""
          className="aspect-video w-full max-w-sm rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full max-w-sm items-center justify-center rounded-md border border-dashed border-border text-xs text-muted">
          {t("noBanner")}
        </div>
      )}

      <p className="max-w-sm text-xs text-muted">{t("sizeHint")}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {mutation.isPending ? t("uploading") : t("changeBanner")}
        </Button>
        {currentBannerUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(null)}
          >
            {t("remove")}
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {(localError || mutation.isError) && (
        <p className="text-xs text-danger">
          {localError ||
            (mutation.error instanceof ApiError ? mutation.error.message : t("errors.saveError"))}
        </p>
      )}
    </div>
  );
}
