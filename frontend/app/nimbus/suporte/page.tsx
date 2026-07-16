"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminSupportSla } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";

/** Acima disso, a dúvida aberta já passou de 24h sem resposta — sinal vermelho de SLA. */
const SLA_WARNING_HOURS = 24;

function SupportSlaContent() {
  const slaQuery = useQuery({
    queryKey: ["admin", "support-sla"],
    queryFn: getAdminSupportSla,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">SLA de Suporte</h1>
          <p className="text-sm text-muted">
            Dúvidas em aberto, ordenadas da mais antiga para a mais recente — o que está há mais
            tempo sem resposta do Personal aparece primeiro.
          </p>
        </div>

        {slaQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {slaQuery.isError && <QueryError error={slaQuery.error} onRetry={() => slaQuery.refetch()} />}

        {slaQuery.data && (
          <Card className="flex flex-col gap-2">
            {slaQuery.data.threads.map((t) => {
              const late = t.hoursOpen >= SLA_WARNING_HOURS;
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-semibold">{t.subject}</span>
                  <span
                    className={
                      late
                        ? "rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger"
                        : "rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                    }
                  >
                    {t.hoursOpen < 1
                      ? "aberta há menos de 1h"
                      : `aberta há ${Math.round(t.hoursOpen)}h`}
                  </span>
                  <span className="text-xs text-muted">
                    desde {new Date(t.openedAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              );
            })}
            {slaQuery.data.threads.length === 0 && (
              <p className="text-sm text-muted">Nenhuma dúvida em aberto agora — tudo respondido.</p>
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
