"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateLocaleRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { getClientLocale, setClientLocale } from "@/i18n/client-locale";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locales";

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
