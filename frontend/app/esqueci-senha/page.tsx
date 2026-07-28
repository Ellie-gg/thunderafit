"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { forgotPasswordRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

/**
 * Fase 81 — "esqueci minha senha". A resposta do backend é SEMPRE a mesma
 * mensagem genérica (exista ou não o e-mail, defesa OWASP contra
 * enumeração de contas) — por isso não há distinção de "e-mail não
 * encontrado" aqui, só sucesso (mensagem genérica) ou erro de conexão/rate limit.
 */
export default function EsqueciSenhaPage() {
  const t = useTranslations("forgotPassword");
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => forgotPasswordRequest(email.trim()),
  });

  const emailLooksValid = /\S+@\S+\.\S+/.test(email);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3">
        <span className="text-3xl" aria-hidden>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          ThunderaFit
        </h1>
      </div>

      <Card
        className="w-full max-w-sm"
        style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
      >
        <h2 className="mb-1 font-display text-xl font-bold text-foreground">{t("title")}</h2>
        <p className="mb-5 text-sm text-muted">{t("subtitle")}</p>

        {mutation.isSuccess ? (
          <p className="text-sm text-success">{mutation.data.message}</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
              />
            </div>

            {mutation.isError && (
              <p className="text-sm text-danger">
                {mutation.error instanceof ApiError ? mutation.error.message : t("connectionError")}
              </p>
            )}

            <Button type="submit" disabled={!emailLooksValid || mutation.isPending} className="mt-2">
              {mutation.isPending ? t("submitting") : t("submit")}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-5 block text-center text-xs font-semibold text-muted hover:text-foreground"
        >
          {t("backToLogin")}
        </Link>
      </Card>
    </main>
  );
}
