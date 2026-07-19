"use client";

import { useQuery } from "@tanstack/react-query";
import { listAdminAccessLogs } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";

const RESOURCE_LABEL: Record<string, string> = {
  anamnesis: "Anamnese",
};

function AccessLogsContent() {
  const logsQuery = useQuery({
    queryKey: ["admin", "access-logs"],
    queryFn: listAdminAccessLogs,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Logs de acesso</h1>
          <p className="text-sm text-muted">
            Transparência interna: todo acesso de um admin a dado sensível (hoje, anamnese) fica
            registrado aqui — quem, quando, qual aluno.
          </p>
        </div>

        {logsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
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
                <span className="font-mono-nums text-xs text-muted">admin: {l.adminId.slice(0, 8)}…</span>
                <span className="font-mono-nums text-xs text-muted">aluno: {l.alunoId.slice(0, 8)}…</span>
                <span className="text-xs text-muted">{new Date(l.createdAt).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {logsQuery.data.logs.length === 0 && (
              <p className="text-sm text-muted">Nenhum acesso a dado sensível registrado ainda.</p>
            )}
          </Card>
        )}

        {/* Fase 33: trilha de ações administrativas sensíveis (hoje só
            mudança de role) — tabela separada de AdminAccessLog (que é
            especificamente sobre acesso a anamnese), mas exibida na mesma
            tela pra manter a auditoria consolidada. */}
        {logsQuery.data && (
          <div>
            <h2 className="mb-2 font-display text-lg font-bold">Ações administrativas</h2>
            <Card className="flex flex-col gap-2">
              {logsQuery.data.auditLogs.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-semibold">{l.action}</span>
                  <span className="text-xs text-muted">{l.details}</span>
                  <span className="font-mono-nums text-xs text-muted">
                    admin: {l.adminId.slice(0, 8)}…
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(l.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
              {logsQuery.data.auditLogs.length === 0 && (
                <p className="text-sm text-muted">Nenhuma ação administrativa registrada ainda.</p>
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
