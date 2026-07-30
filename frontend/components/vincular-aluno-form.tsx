"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { createClientInvite } from "@/lib/api/client-invites";
import { ApiError } from "@/lib/api/client";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function buildInviteLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/login?invite=${token}`;
}

/**
 * Fase 104 — substitui por completo o fluxo antigo de "digita o e-mail do
 * aluno e espera ele já ter conta". Agora o Personal só dá um apelido (pra
 * reconhecer o convite na própria lista — nunca mostrado pra quem abre o
 * link) e recebe um link único pra compartilhar. Quem abrir aquele link
 * específico e completar o cadastro (ou logar, se já tiver conta) vira o
 * aluno vinculado automaticamente — sem precisar saber o e-mail certo de
 * antemão, e sem precisar voltar aqui depois pra "aceitar" nada.
 */
export function VincularAlunoForm({
  dashboardPath,
  professionalLabel,
}: {
  dashboardPath: string;
  /** Usado só na mensagem do WhatsApp ("...como seu(sua) Personal Trainer/Nutricionista"). */
  professionalLabel: string;
}) {
  const t = useTranslations("vincularAlunoForm");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");

  const mutation = useMutation({
    mutationFn: () => createClientInvite(label.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-invites"] });
    },
  });

  if (mutation.isSuccess) {
    const link = buildInviteLink(mutation.data.token);
    return (
      <Card className="w-full max-w-sm">
        <h1 className="mb-2 font-display text-xl font-bold">{t("created.title")}</h1>
        <p className="mb-5 text-sm text-muted">{t("created.subtitle")}</p>

        <div className="flex flex-col gap-3">
          <Button type="button" asChild>
            <a
              href={buildWhatsAppShareUrl(t("created.whatsAppText", { professionalLabel, link }))}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("created.sendWhatsApp")}
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            {t("created.copyLink")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(dashboardPath)}>
            {t("created.done")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-1 font-display text-xl font-bold">{t("title")}</h1>
      <p className="mb-4 text-sm text-muted">{t("subtitle")}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="label">{t("labelField")}</Label>
          <Input
            id="label"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("labelPlaceholder")}
          />
          <p className="text-xs text-muted">{t("labelHint")}</p>
        </div>

        {mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : t("errors.connection")}
          </p>
        )}

        <Button type="submit" disabled={!label.trim() || mutation.isPending}>
          {mutation.isPending ? t("submitting") : t("submit")}
        </Button>
      </form>
    </Card>
  );
}
