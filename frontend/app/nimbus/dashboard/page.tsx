"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";

const ROLE_LABEL: Record<string, string> = {
  PERSONAL: "Personal Trainers",
  ALUNO: "Alunos",
  NUTRICIONISTA: "Nutricionistas",
  ADMIN: "Admins",
};

function OverviewContent() {
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
          <h1 className="font-display text-2xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-muted">
            Visão agregada da plataforma. Nenhum dado aqui identifica conteúdo sensível — anamnese
            fica em uma tela própria, com acesso auditado.
          </p>
        </div>

        {overviewQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
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
                Profissionais no limite Freemium (3/3)
              </span>
              <span className="font-mono-nums text-2xl font-bold">
                {overview.professionalsAtFreemiumLimit}
                <span className="text-sm font-normal text-muted"> / {overview.totalProfessionals} profissionais</span>
              </span>
              <p className="text-sm text-muted">
                Sinal de oportunidade de upgrade: Personal Trainers e Nutricionistas que já
                esgotaram o plano gratuito.
              </p>
            </Card>

            <Card className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                Novos usuários — últimos 30 dias
              </span>
              {overview.newUsersByDay.length === 0 && (
                <p className="text-sm text-muted">Nenhum usuário novo no período.</p>
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
                    title={`${d.day}: ${d.count} novo(s)`}
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
