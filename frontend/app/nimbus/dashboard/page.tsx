"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";

function OverviewContent() {
  const t = useTranslations("nimbusDashboard");
  const tCommon = useTranslations("common");

  const ROLE_LABEL: Record<string, string> = {
    PERSONAL: t("roleLabel.personal"),
    ALUNO: t("roleLabel.aluno"),
    NUTRICIONISTA: t("roleLabel.nutricionista"),
    ADMIN: t("roleLabel.admin"),
  };

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverview,
  });

  const overview = overviewQuery.data;
  const maxDayCount = Math.max(1, ...(overview?.newUsersByDay.map((d) => d.count) ?? [1]));

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>

        {overviewQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {overviewQuery.isError && (
          <QueryError error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />
        )}

        {overview && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(ROLE_LABEL).map(([role, label]) => (
                <Card key={role} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                    {label}
                  </span>
                  <span className="font-mono-nums text-2xl font-bold">
                    {overview.usersByRole[role] ?? 0}
                  </span>
                </Card>
              ))}
            </div>

            <Card className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("freemiumLimitTitle")}
              </span>
              <span className="font-mono-nums text-2xl font-bold">
                {overview.professionalsAtFreemiumLimit}
                <span className="text-sm font-normal text-muted">
                  {t("freemiumLimitTotal", { total: overview.totalProfessionals })}
                </span>
              </span>
              <p className="text-sm text-muted">{t("freemiumLimitDescription")}</p>
            </Card>

            <Card className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("newUsersTitle")}
              </span>
              {overview.newUsersByDay.length === 0 && (
                <p className="text-sm text-muted">{t("newUsersEmpty")}</p>
              )}
              <div className="flex items-end gap-1" style={{ height: "80px" }}>
                {overview.newUsersByDay.map((d) => (
                  <div
                    key={d.day}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max(4, (d.count / maxDayCount) * 100)}%`,
                      backgroundColor: "var(--role-admin)",
                    }}
                    title={t("dayBarTitle", { day: d.day, count: d.count })}
                  />
                ))}
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function AdminOverviewPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <OverviewContent />
    </AuthGuard>
  );
}
