"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Estado de erro reutilizável para queries do TanStack Query — antes desta
 * fase, várias telas (dashboard, /treinos, dashboard do Personal, /evolucao)
 * simplesmente ficavam presas em "Carregando..." para sempre se a query
 * falhasse, sem feedback nenhum pro usuário. Centralizado aqui para manter a
 * mensagem e o botão de "Tentar novamente" consistentes em todas elas.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("queryError");
  const message = error instanceof ApiError ? error.message : t("connectionError");
  // Fase 103: acesso restrito porque o Personal do aluno está acima do
  // limite do plano dele — não é uma falha/bug do app, então não deveria
  // parecer um erro (vermelho, tom de alarme). Único código com tratamento
  // especial aqui de propósito: os outros (ex: PREMIUM_REQUIRED) já mostram
  // seu próprio CTA de upgrade fora deste componente compartilhado.
  const isPersonalRestricted =
    error instanceof ApiError && error.data?.code === "PERSONAL_PLAN_RESTRICTED";

  return (
    <Card className="flex flex-col gap-3">
      <p className={isPersonalRestricted ? "text-sm text-muted" : "text-sm text-danger"}>
        {message}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry} className="self-start">
        {t("retry")}
      </Button>
    </Card>
  );
}
