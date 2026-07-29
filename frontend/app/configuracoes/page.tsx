"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { updateLocaleRequest } from "@/lib/api/auth";
import { getBillingStatus, getAlunoPremiumStatus } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { getClientLocale, setClientLocale } from "@/i18n/client-locale";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locales";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

/**
 * Fase 93 — "em algum lugar no menu" pra ver a assinatura e quando ela
 * termina: /configuracoes já é acessível por qualquer role (allowedRoles
 * omitido) e já nasceu "pensada pra crescer" (comentário abaixo) — reaproveita
 * esse mesmo card-por-assunto em vez de inventar uma tela nova. PERSONAL já
 * tinha um link "Planos" dedicado (/personal/upgrade, com o botão de
 * cancelar/gerenciar de verdade) — aqui é só um resumo rápido com link pra
 * lá. ALUNO nunca teve NENHUM lugar pra ver isso; aqui é a fonte única.
 * NUTRICIONISTA está fora do escopo por ora — nem `/personal/upgrade` aceita
 * esse role hoje (gap pré-existente, não introduzido nesta fase).
 */
function SubscriptionCard() {
  const t = useTranslations("settings");
  const intlLocale = useActiveIntlLocale();
  const role = useAuthStore((s) => s.user?.role);

  const billingQuery = useQuery({
    queryKey: ["billing-status"],
    queryFn: getBillingStatus,
    enabled: role === "PERSONAL",
  });
  const premiumQuery = useQuery({
    queryKey: ["aluno-premium-status"],
    queryFn: getAlunoPremiumStatus,
    enabled: role === "ALUNO",
  });

  if (role === "PERSONAL") {
    if (billingQuery.isLoading) return null;
    if (billingQuery.isError) {
      return (
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">{t("subscription.title")}</h2>
          <QueryError error={billingQuery.error} onRetry={() => billingQuery.refetch()} />
        </Card>
      );
    }
    const data = billingQuery.data;
    if (!data) return null;
    const tier = data.planoAssinatura;
    const isPago = tier !== "FREE";
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">{t("subscription.title")}</h2>
        <p className="text-sm text-muted">
          {isPago
            ? t("subscription.personalPlano", { plano: tier === "PLUS" ? "Plus" : "Base" })
            : t("subscription.personalGratuito")}
        </p>
        {data.planoAssinaturaExpiresAt && (
          <p className="text-xs text-muted">
            {t("subscription.expiraEm", {
              date: new Date(data.planoAssinaturaExpiresAt).toLocaleDateString(intlLocale),
            })}
          </p>
        )}
        <Button asChild variant="secondary" className="self-start">
          <Link href="/personal/upgrade">{t("subscription.gerenciarLink")}</Link>
        </Button>
      </Card>
    );
  }

  if (role === "ALUNO") {
    if (premiumQuery.isLoading) return null;
    if (premiumQuery.isError) {
      return (
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">{t("subscription.title")}</h2>
          <QueryError error={premiumQuery.error} onRetry={() => premiumQuery.refetch()} />
        </Card>
      );
    }
    const data = premiumQuery.data;
    if (!data) return null;
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">{t("subscription.title")}</h2>
        <p className="text-sm text-muted">
          {data.hasAccess
            ? t(
                data.status === "TRIAL"
                  ? "subscription.alunoTrialAtivo"
                  : data.status === "CANCELED"
                    ? "subscription.alunoCanceladoAtivo"
                    : "subscription.alunoPremiumAtivo"
              )
            : t("subscription.alunoSemPremium")}
        </p>
        {data.hasAccess && data.premiumExpiresAt && (
          <p className="text-xs text-muted">
            {t("subscription.expiraEm", {
              date: new Date(data.premiumExpiresAt).toLocaleDateString(intlLocale),
            })}
          </p>
        )}
        {!data.hasAccess && (
          <Button asChild variant="secondary" className="self-start">
            <Link href="/meu-treino-pessoal">{t("subscription.conhecerLink")}</Link>
          </Button>
        )}
      </Card>
    );
  }

  return null;
}

/**
 * Tela de Configurações — nasce só com o seletor de idioma, mas pensada pra
 * crescer: cada preferência futura vira um novo <Card> de seção, seguindo o
 * mesmo padrão já usado em /perfil (um Card por assunto). Qualquer role
 * autenticada acessa (allowedRoles omitido de propósito).
 */
function ConfiguracoesContent() {
  const t = useTranslations("settings");
  const [current, setCurrent] = useState<AppLocale>(() => getClientLocale());
  const [savingLocale, setSavingLocale] = useState<AppLocale | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function chooseLocale(locale: AppLocale) {
    if (locale === current) return;
    setSavingLocale(locale);
    setError(null);
    try {
      // Grava o cookie (aplica no próximo request) e sincroniza com o banco
      // (User.locale) pra acompanhar o usuário entre dispositivos.
      setClientLocale(locale);
      await updateLocaleRequest(locale.toUpperCase() as "PT" | "EN" | "ES");
      setCurrent(locale);
      // O locale é resolvido no servidor (i18n/request.ts, via cookie) — só
      // uma navegação nova relê o cookie e troca os textos renderizados.
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("language.saveError"));
      setSavingLocale(null);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <SubscriptionCard />

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">{t("language.title")}</h2>
          <p className="text-sm text-muted">{t("language.description")}</p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {SUPPORTED_LOCALES.map((locale) => {
              const active = current === locale;
              return (
                <button
                  key={locale}
                  type="button"
                  onClick={() => chooseLocale(locale)}
                  disabled={savingLocale !== null}
                  aria-pressed={active}
                  className={
                    active
                      ? "flex-1 rounded-md border border-accent bg-accent/10 px-4 py-3 text-sm font-semibold text-accent"
                      : "flex-1 rounded-md border border-border px-4 py-3 text-sm text-muted hover:border-accent disabled:opacity-60"
                  }
                >
                  {t(`language.${locale}`)}
                  {savingLocale === locale && "…"}
                </button>
              );
            })}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </Card>
      </main>
    </>
  );
}

export default function ConfiguracoesPage() {
  return (
    <AuthGuard>
      <ConfiguracoesContent />
    </AuthGuard>
  );
}
