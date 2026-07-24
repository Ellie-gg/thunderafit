"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listAdminLogins } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

function LoginsContent() {
  const t = useTranslations("nimbusLogins");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const loginsQuery = useQuery({
    queryKey: ["admin", "logins"],
    queryFn: listAdminLogins,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>

        {loginsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {loginsQuery.isError && (
          <QueryError error={loginsQuery.error} onRetry={() => loginsQuery.refetch()} />
        )}

        {loginsQuery.data && (
          <Card className="flex flex-col gap-2">
            {loginsQuery.data.logins.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm font-semibold">{l.email}</span>
                <span className="font-mono-nums text-xs text-muted">{l.ipAddress ?? t("unknownIp")}</span>
                <span className="text-xs text-muted">{new Date(l.createdAt).toLocaleString(intlLocale)}</span>
              </div>
            ))}
            {loginsQuery.data.logins.length === 0 && (
              <p className="text-sm text-muted">{t("empty")}</p>
            )}
          </Card>
        )}
      </main>
    </>
  );
}

export default function AdminLoginsPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <LoginsContent />
    </AuthGuard>
  );
}
