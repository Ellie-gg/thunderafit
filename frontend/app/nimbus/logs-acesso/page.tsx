"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listAdminAccessLogs } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

function AccessLogsContent() {
  const t = useTranslations("nimbusLogsAcesso");
  const tCommon = useTranslations("common");
  const RESOURCE_LABEL: Record<string, string> = {
    anamnesis: t("resourceLabel.anamnesis"),
  };
  const intlLocale = useActiveIntlLocale();
  const logsQuery = useQuery({
    queryKey: ["admin", "access-logs"],
    queryFn: listAdminAccessLogs,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>

        {logsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {logsQuery.isError && (
          <QueryError error={logsQuery.error} onRetry={() => logsQuery.refetch()} />
        )}

        {logsQuery.data && (
          <Card className="flex flex-col gap-2">
            {logsQuery.data.logs.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm font-semibold">
                  {RESOURCE_LABEL[l.resourceType] ?? l.resourceType}
                </span>
                <span className="font-mono-nums text-xs text-muted">{t("adminPrefix")}{l.adminId.slice(0, 8)}…</span>
                <span className="font-mono-nums text-xs text-muted">{t("alunoPrefix")}{l.alunoId.slice(0, 8)}…</span>
                <span className="text-xs text-muted">{new Date(l.createdAt).toLocaleString(intlLocale)}</span>
              </div>
            ))}
            {logsQuery.data.logs.length === 0 && (
              <p className="text-sm text-muted">{t("empty")}</p>
            )}
          </Card>
        )}

        {/* Fase 33: trilha de ações administrativas sensíveis (hoje só
            mudança de role) — tabela separada de AdminAccessLog (que é
            especificamente sobre acesso a anamnese), mas exibida na mesma
            tela pra manter a auditoria consolidada. */}
        {logsQuery.data && (
          <div>
            <h2 className="mb-2 font-display text-lg font-bold">{t("auditTitle")}</h2>
            <Card className="flex flex-col gap-2">
              {logsQuery.data.auditLogs.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-semibold">{l.action}</span>
                  <span className="text-xs text-muted">{l.details}</span>
                  <span className="font-mono-nums text-xs text-muted">
                    {t("adminPrefix")}{l.adminId.slice(0, 8)}…
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(l.createdAt).toLocaleString(intlLocale)}
                  </span>
                </div>
              ))}
              {logsQuery.data.auditLogs.length === 0 && (
                <p className="text-sm text-muted">{t("auditEmpty")}</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </>
  );
}

export default function AdminAccessLogsPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <AccessLogsContent />
    </AuthGuard>
  );
}
