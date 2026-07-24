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
 * Redimensiona/recorta a imagem escolhida num retângulo 16:9 de
 * BANNER_WIDTH_PX x BANNER_HEIGHT_PX, inteiramente no navegador (canvas) —
 * mesmo raciocínio de `avatar-upload.tsx` (recorta a MENOR dimensão antes de
 * redimensionar, preservando proporção), só que o alvo é um retângulo 16:9
 * em vez de um quadrado: recorta o maior retângulo 16:9 centralizado que
 * cabe dentro da imagem original, depois redimensiona pro tamanho final.
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

    const targetRatio = BANNER_WIDTH_PX / BANNER_HEIGHT_PX;
    const srcRatio = img.naturalWidth / img.naturalHeight;

    let cropWidth = img.naturalWidth;
    let cropHeight = img.naturalHeight;
    if (srcRatio > targetRatio) {
      // Imagem mais larga que 16:9 — recorta as laterais.
      cropWidth = Math.round(img.naturalHeight * targetRatio);
    } else {
      // Imagem mais "quadrada"/alta que 16:9 — recorta topo/base.
      cropHeight = Math.round(img.naturalWidth / targetRatio);
    }
    const sx = Math.round((img.naturalWidth - cropWidth) / 2);
    const sy = Math.round((img.naturalHeight - cropHeight) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = BANNER_WIDTH_PX;
    canvas.height = BANNER_HEIGHT_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t("errors.canvasFailed"));
    ctx.drawImage(
      img,
      sx,
      sy,
      cropWidth,
      cropHeight,
      0,
      0,
      BANNER_WIDTH_PX,
      BANNER_HEIGHT_PX
    );

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
