"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { sendContactMessage } from "@/lib/api/contact";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MAX_MESSAGE_LENGTH = 500;

/**
 * Fase 78 — "Fale Conosco": qualquer papel autenticado (Aluno, Personal,
 * Nutricionista) manda uma mensagem pro fundador. Sem seleção de role — o
 * backend já sabe quem está mandando (token) e grava junto com a mensagem.
 */
function FaleConoscoContent() {
  const t = useTranslations("faleConosco");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const sendMutation = useMutation({
    mutationFn: () => sendContactMessage(title.trim(), message.trim()),
    onSuccess: () => {
      setTitle("");
      setMessage("");
    },
  });

  const remaining = MAX_MESSAGE_LENGTH - message.length;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            {t("eyebrow")}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <Card className="w-full max-w-lg">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && message.trim()) sendMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-title">{t("titleLabel")}</Label>
              <Input
                id="contact-title"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="contact-message">{t("messageLabel")}</Label>
                <span className={`text-xs ${remaining < 0 ? "text-danger" : "text-muted"}`}>
                  {t("charsRemaining", { count: remaining })}
                </span>
              </div>
              <textarea
                id="contact-message"
                required
                rows={6}
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            {sendMutation.isError && (
              <p className="text-sm text-danger">
                {sendMutation.error instanceof ApiError ? sendMutation.error.message : t("sendError")}
              </p>
            )}
            {sendMutation.isSuccess && <p className="text-sm text-success">{t("sendSuccess")}</p>}

            <Button
              type="submit"
              disabled={sendMutation.isPending || !title.trim() || !message.trim()}
              className="self-start"
            >
              {sendMutation.isPending ? t("sending") : t("send")}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}

export default function FaleConoscoPage() {
  return (
    <AuthGuard>
      <FaleConoscoContent />
    </AuthGuard>
  );
}
