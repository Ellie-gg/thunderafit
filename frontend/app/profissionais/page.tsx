"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  searchProfessionals,
  listConnectionRequests,
  createConnectionRequest,
  type ConnectionStatus,
} from "@/lib/api/connections";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const t = useTranslations("profissionais");
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    PENDENTE: { label: t("statusPending"), cls: "bg-accent/15 text-accent" },
    ACEITA: { label: t("statusAccepted"), cls: "bg-success/15 text-success" },
    RECUSADA: { label: t("statusRejected"), cls: "bg-danger/15 text-danger" },
  };
  const m = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function ProfissionaisContent() {
  const t = useTranslations("profissionais");
  const queryClient = useQueryClient();
  const [location, setLocation] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  const searchQuery = useQuery({
    queryKey: ["professionals-search", submitted ?? ""],
    queryFn: () => searchProfessionals(submitted),
  });
  const requestsQuery = useQuery({
    queryKey: ["connection-requests"],
    queryFn: listConnectionRequests,
  });

  const requestMutation = useMutation({
    mutationFn: (professionalId: string) => createConnectionRequest(professionalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-requests"] });
    },
  });

  const requests = requestsQuery.data?.requests ?? [];
  // id do profissional -> status da minha solicitação (para rotular os resultados)
  const statusByPro = new Map(requests.map((r) => [r.counterpart.id, r.status]));

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            {t("discover")}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <Card className="flex flex-col gap-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(location.trim() || undefined);
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="location">{t("locationLabel")}</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("locationPlaceholder")}
              />
            </div>
            <Button type="submit">{t("searchButton")}</Button>
          </form>
        </Card>

        {searchQuery.isLoading && <p className="text-sm text-muted">{t("searching")}</p>}
        {searchQuery.isError && (
          <QueryError error={searchQuery.error} onRetry={() => searchQuery.refetch()} />
        )}
        {searchQuery.isSuccess && searchQuery.data.professionals.length === 0 && (
          <Card>
            <p className="text-sm text-muted">
              {t("noResultsFound", {
                location: submitted ? t("inLocationSuffix", { location: submitted }) : "",
              })}
            </p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {searchQuery.data?.professionals.map((p) => {
            const myStatus = statusByPro.get(p.id);
            return (
              <Card
                key={p.id}
                className="flex flex-col gap-2"
                style={{
                  borderTopWidth: p.planoAssinatura === "PLUS" ? "3px" : "3px",
                  borderTopColor: p.planoAssinatura === "PLUS" ? "var(--accent)" : "var(--role-personal)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{p.email.split("@")[0]}</p>
                      {/* Billing 3 degraus: Plus aparece com destaque no diretório. */}
                      {p.planoAssinatura === "PLUS" && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                          ★ Plus
                        </span>
                      )}
                    </div>
                    {p.location && <p className="text-xs text-muted">📍 {p.location}</p>}
                  </div>
                </div>
                {p.bio && <p className="text-sm text-muted">{p.bio}</p>}
                {myStatus ? (
                  <div className="self-start">
                    <StatusBadge status={myStatus} />
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="self-start"
                    disabled={requestMutation.isPending}
                    onClick={() => requestMutation.mutate(p.id)}
                  >
                    {requestMutation.isPending && requestMutation.variables === p.id
                      ? t("sending")
                      : t("requestConnection")}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        {requestMutation.isError && (
          <p className="text-sm text-danger">
            {requestMutation.error instanceof ApiError
              ? requestMutation.error.message
              : t("sendRequestError")}
          </p>
        )}

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="font-display text-lg font-bold">{t("myRequests")}</h2>
          {requestsQuery.isSuccess && requests.length === 0 && (
            <p className="text-sm text-muted">{t("noRequestsSent")}</p>
          )}
          {requests.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{r.counterpart.email.split("@")[0]}</p>
                {r.counterpart.location && (
                  <p className="text-xs text-muted">📍 {r.counterpart.location}</p>
                )}
              </div>
              <StatusBadge status={r.status} />
            </Card>
          ))}
        </section>
      </main>
    </>
  );
}

export default function ProfissionaisPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <ProfissionaisContent />
    </AuthGuard>
  );
}
