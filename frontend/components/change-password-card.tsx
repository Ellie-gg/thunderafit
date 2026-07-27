"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { changePasswordRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Fase 80 — botão "Trocar senha" no perfil (aluno e Personal). "Senha
 * atual" é opcional aqui de propósito: só é realmente exigida pelo backend
 * quando a conta já tem uma senha — uma conta criada só via Google (Fase
 * 77) define a senha pela 1ª vez sem precisar de uma "atual" que nunca
 * existiu. Deixar o campo em branco e deixar o backend decidir evita ter
 * que saber de antemão, no client, se esta conta tem senha ou não.
 */
export function ChangePasswordCard() {
  const t = useTranslations("changePassword");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePasswordRequest(currentPassword.trim() || undefined, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
    },
  });

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold">{t("title")}</h2>
        <p className="text-xs text-muted">{t("description")}</p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (newPassword.trim()) mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">{t("currentPasswordLabel")}</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="text-xs text-muted">{t("currentPasswordHint")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">{t("newPasswordLabel")}</Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : t("saveError")}
          </p>
        )}
        {mutation.isSuccess && <p className="text-sm text-success">{t("saveSuccess")}</p>}

        <Button type="submit" disabled={mutation.isPending || !newPassword.trim()} className="self-start">
          {mutation.isPending ? t("saving") : t("saveButton")}
        </Button>
      </form>
    </Card>
  );
}
