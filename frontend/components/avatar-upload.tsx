"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateAvatarRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

// Fase 30: tamanho final do avatar — pequeno o bastante pra caber
// confortavelmente como data URI numa coluna de texto do Postgres (o
// backend também valida isso de novo, não confia só nisso).
const AVATAR_SIZE_PX = 256;
const JPEG_QUALITY = 0.82;

/**
 * Redimensiona/recorta a imagem escolhida num quadrado de AVATAR_SIZE_PX,
 * inteiramente no navegador (canvas) — o servidor nunca recebe o arquivo
 * original, só o resultado já pequeno.
 *
 * Bugs potenciais considerados antes de escrever esta função:
 * - não validar `file.type` antes de tentar desenhar no canvas — o atributo
 *   `accept="image/*"` do input é só uma sugestão de UI, um usuário pode
 *   escolher qualquer arquivo mesmo assim.
 * - desenhar a imagem original inteira sem redimensionar geraria um data URL
 *   enorme (e mais lento) — sempre desenha já no tamanho final.
 * - esticar a imagem pro quadrado final distorceria o avatar circular —
 *   recorta um quadrado central (crop) da MENOR dimensão antes de redimensionar,
 *   preservando a proporção.
 * - vazar memória com `URL.createObjectURL` sem `revokeObjectURL` depois de
 *   carregar a imagem no `<img>` temporário.
 * - pedir "image/webp" pode falhar silenciosamente em navegadores muito
 *   antigos (`toBlob` retorna null) — cai pra "image/jpeg" nesse caso.
 */
async function resizeImageToSquareDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem (PNG, JPEG ou WebP).");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = objectUrl;
    });

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE_PX;
    canvas.height = AVATAR_SIZE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem.");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

    const dataUrl = canvas.toDataURL("image/webp", JPEG_QUALITY);
    // Alguns navegadores antigos ignoram "image/webp" e devolvem PNG (bem
    // maior) sem avisar — nesse caso cai pra JPEG, que comprime melhor que PNG.
    if (!dataUrl.startsWith("data:image/webp")) {
      return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Fase 30: upload de foto de perfil — componente reutilizável, sem nada
 * específico de fitness/domínio (redimensiona no cliente, sobe já pequeno).
 * Usado tanto na tela de perfil do aluno quanto do Personal.
 */
export function AvatarUpload() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (avatarDataUrl: string | null) => updateAvatarRequest(avatarDataUrl),
    onSuccess: (data) => {
      setSession(data.user);
      setLocalError(null);
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;

    setLocalError(null);
    try {
      const dataUrl = await resizeImageToSquareDataUrl(file);
      mutation.mutate(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Erro ao processar a imagem.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar email={user?.email ?? ""} avatarUrl={user?.avatarUrl ?? null} size={64} />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {mutation.isPending ? "Enviando..." : "Trocar foto"}
          </Button>
          {user?.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
            >
              Remover
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
              (mutation.error instanceof ApiError
                ? mutation.error.message
                : "Erro ao salvar a foto.")}
          </p>
        )}
      </div>
    </div>
  );
}
