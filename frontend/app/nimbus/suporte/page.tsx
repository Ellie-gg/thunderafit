"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getAdminSupportSla } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

/** Acima disso, a dúvida aberta já passou de 24h sem resposta — sinal vermelho de SLA. */
const SLA_WARNING_HOURS = 24;

function SupportSlaContent() {
  const t = useTranslations("nimbusSuporte");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const slaQuery = useQuery({
    queryKey: ["admin", "support-sla"],
    queryFn: getAdminSupportSla,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>

        {slaQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {slaQuery.isError && <QueryError error={slaQuery.error} onRetry={() => slaQuery.refetch()} />}

        {slaQuery.data && (
          <Card className="flex flex-col gap-2">
            {slaQuery.data.threads.map((thread) => {
              const late = thread.hoursOpen >= SLA_WARNING_HOURS;
              return (
                <div
                  key={thread.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-semibold">{thread.subject}</span>
                  <span
                    className={
                      late
                        ? "rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger"
                        : "rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                    }
                  >
                    {thread.hoursOpen < 1
                      ? t("openLessThanHour")
                      : t("openHours", { hours: Math.round(thread.hoursOpen) })}
                  </span>
                  <span className="text-xs text-muted">
                    {t("since", { date: new Date(thread.openedAt).toLocaleString(intlLocale) })}
                  </span>
                </div>
              );
            })}
            {slaQuery.data.threads.length === 0 && (
              <p className="text-sm text-muted">{t("empty")}</p>
            )}
          </Card>
        )}
      </main>
    </>
  );
}

export default function AdminSupportSlaPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <SupportSlaContent />
    </AuthGuard>
  );
}
