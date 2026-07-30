"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getBillingStatus } from "@/lib/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Fase 103 — banner "você tem mais alunos do que seu plano permite",
 * mesmo padrão de `EmailVerificationBanner` (renderizado dentro do
 * AppHeader, aparece em toda tela autenticada quando aplicável). Só
 * PERSONAL/NUTRICIONISTA têm `limiteAlunos` de verdade — ALUNO/ADMIN nunca
 * disparam `overLimiteAlunos` (ver plan-expiry.ts#getPersonalAccessStatus),
 * mas o `role` é checado aqui também por clareza/defesa explícita.
 *
 * 2 estados visuais: dentro da carência (aviso, ainda dá pra prescrever) vs.
 * já bloqueado (aviso mais forte, prescrição já está recusada pelo backend).
 * O CTA "Gerenciar alunos" é a mesma ação de autorregularização em
 * qualquer um dos dois estados — desvincular fica sempre disponível, mesmo
 * bloqueado (ver `RemoveAlunoButton`).
 */
export function PersonalOverLimitBanner() {
  const t = useTranslations("personalOverLimitBanner");
  const user = useAuthStore((s) => s.user);
  const isProfessional = user?.role === "PERSONAL" || user?.role === "NUTRICIONISTA";

  const statusQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus,
    enabled: isProfessional,
  });

  if (!isProfessional || !statusQuery.data?.overLimiteAlunos) return null;

  const blocked = statusQuery.data.overLimiteAlunosBlocked;
  const graceDaysLeft = statusQuery.data.overLimiteAlunosGraceDaysLeft;

  return (
    <div
      className={`flex flex-col items-center justify-between gap-2 border-b px-4 py-2 text-sm sm:flex-row sm:px-6 ${
        blocked ? "border-danger/40 bg-danger/10" : "border-accent/40 bg-accent/10"
      }`}
    >
      <p className="text-foreground">
        {blocked ? t("blockedMessage") : t("graceMessage", { days: graceDaysLeft ?? 0 })}
      </p>
      <Link
        href="/personal/alunos"
        className="shrink-0 text-xs font-semibold text-accent underline hover:text-foreground"
      >
        {t("manageStudentsCta")}
      </Link>
    </div>
  );
}
