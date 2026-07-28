"use client";

import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { resendVerificationEmailRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Fase 81 — banner "confirme seu e-mail". Aparece em toda tela autenticada
 * (renderizado dentro do AppHeader) enquanto `user.emailVerifiedAt` for
 * null. Some sozinho assim que o usuário clica no link do e-mail em
 * qualquer aba (a tela /verificar-email atualiza a sessão local se for a
 * mesma conta) ou faz login de novo depois de confirmar.
 */
export function EmailVerificationBanner() {
  const t = useTranslations("emailVerificationBanner");
  const user = useAuthStore((s) => s.user);

  const mutation = useMutation({
    mutationFn: resendVerificationEmailRequest,
  });

  if (!user || user.emailVerifiedAt) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-b border-accent/40 bg-accent/10 px-4 py-2 text-sm sm:flex-row sm:px-6">
      <p className="text-foreground">{t("message", { email: user.email })}</p>
      <div className="flex items-center gap-3">
        {mutation.isSuccess && <span className="text-xs text-success">{t("resent")}</span>}
        {mutation.isError && (
          <span className="text-xs text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : t("resendError")}
          </span>
        )}
        <button
          type="button"
          disabled={mutation.isPending || mutation.isSuccess}
          onClick={() => mutation.mutate()}
          className="shrink-0 text-xs font-semibold text-accent underline hover:text-foreground disabled:opacity-60"
        >
          {mutation.isPending ? t("resending") : t("resendButton")}
        </button>
      </div>
    </div>
  );
}
