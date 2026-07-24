"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listConnectionRequests,
  acceptConnectionRequest,
  rejectConnectionRequest,
  type ConnectionStatus,
} from "@/lib/api/connections";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { useTranslations } from "next-intl";

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const t = useTranslations("personalSolicitacoes");
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    PENDENTE: { label: t("pendente"), cls: "bg-accent/15 text-accent" },
    ACEITA: { label: t("aceita"), cls: "bg-success/15 text-success" },
    RECUSADA: { label: t("recusada"), cls: "bg-danger/15 text-danger" },
  };
  const m = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function SolicitacoesContent() {
  const t = useTranslations("personalSolicitacoes");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ["connection-requests"], queryFn: listConnectionRequests });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["connection-requests"] });
    queryClient.invalidateQueries({ queryKey: ["relations"] });
  };
  const acceptMutation = useMutation({ mutationFn: (id: string) => acceptConnectionRequest(id), onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: (id: string) => rejectConnectionRequest(id), onSuccess: invalidate });

  const requests = requestsQuery.data?.requests ?? [];
  const pendentes = requests.filter((r) => r.status === "PENDENTE");
  const respondidas = requests.filter((r) => r.status !== "PENDENTE");
  const activeError = acceptMutation.error ?? rejectMutation.error;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            {t("solicitacoes")}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-muted">{t("subtitulo")}</p>
        </div>

        {requestsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
        {requestsQuery.isError && (
          <QueryError error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />
        )}

        {activeError && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {activeError instanceof ApiError ? activeError.message : t("erroResponder")}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">
            {t("pendentes", { count: pendentes.length })}
          </h2>
          {requestsQuery.isSuccess && pendentes.length === 0 && (
            <p className="text-sm text-muted">{t("nenhumaPendente")}</p>
          )}
          {pendentes.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3">
              <div>
                <p className="font-semibold">{r.counterpart.email}</p>
                {r.counterpart.location && <p className="text-xs text-muted">📍 {r.counterpart.location}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                  onClick={() => acceptMutation.mutate(r.id)}
                >
                  {acceptMutation.isPending && acceptMutation.variables === r.id
                    ? t("aceitando")
                    : t("aceitar")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(r.id)}
                >
                  {t("recusar")}
                </Button>
              </div>
            </Card>
          ))}
        </section>

        {respondidas.length > 0 && (
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="font-display text-lg font-bold">{t("historico")}</h2>
            {respondidas.map((r) => (
              <Card key={r.id} className="flex items-center justify-between">
                <span className="text-sm">{r.counterpart.email}</span>
                <StatusBadge status={r.status} />
              </Card>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

export default function SolicitacoesPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <SolicitacoesContent />
    </AuthGuard>
  );
}
