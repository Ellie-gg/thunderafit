"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { deleteMyAccountRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Fase 81 — "Excluir minha conta" no perfil (aluno e Personal). Mesmo
 * padrão inline de confirmação em 2 etapas já usado no `DeleteUserButton`
 * do admin (Fase 80) — nunca aplica no primeiro clique. `password` é
 * opcional aqui pelo mesmo motivo do `ChangePasswordCard`: só é
 * obrigatória de verdade quando a conta já tem uma senha (backend decide).
 */
export function DeleteAccountCard() {
  const t = useTranslations("deleteAccount");
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => deleteMyAccountRequest(password.trim() || undefined),
    onSuccess: () => {
      clearSession();
      router.replace("/login");
    },
  });

  if (!confirming) {
    return (
      <Card className="flex flex-col gap-3 border-danger/40">
        <div>
          <h2 className="font-display text-lg font-bold text-danger">{t("title")}</h2>
          <p className="text-xs text-muted">{t("description")}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="self-start border-danger/60 text-danger hover:border-danger"
          onClick={() => setConfirming(true)}
        >
          {t("openButton")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 border-danger/60 bg-danger/5">
      <div>
        <h2 className="font-display text-lg font-bold text-danger">{t("confirmTitle")}</h2>
        <ul className="mt-2 list-disc pl-5 text-xs text-muted">
          <li>{t("warnings.workouts")}</li>
          <li>{t("warnings.progress")}</li>
          <li>{t("warnings.relations")}</li>
          <li>{t("warnings.irreversible")}</li>
        </ul>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-account-password">{t("passwordLabel")}</Label>
          <Input
            id="delete-account-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="text-xs text-muted">{t("passwordHint")}</p>
        </div>

        {mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : t("genericError")}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setConfirming(false);
              setPassword("");
              mutation.reset();
            }}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={mutation.isPending}
            className="border-danger/60 text-danger hover:border-danger"
          >
            {mutation.isPending ? t("deleting") : t("confirmButton")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
