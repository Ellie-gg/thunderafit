"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  searchProfessionals,
  listConnectionRequests,
  createConnectionRequest,
  getMyProfile,
  updateMyProfile,
  type ConnectionStatus,
} from "@/lib/api/connections";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { CityStateInput } from "@/components/city-state-input";
import { ProfessionalCard } from "@/components/professional-card";

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
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [submitted, setSubmitted] = useState<{ city?: string; state?: string } | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  // Trava contra uma corrida real: se o aluno já começar a digitar antes do
  // perfil terminar de carregar (rede lenta, ou só um usuário rápido), o
  // efeito de pré-preenchimento abaixo NÃO pode sobrescrever o que ele já
  // digitou quando a resposta chegar — só preenche os campos de verdade se
  // o usuário ainda não tiver tocado neles.
  const userEditedRef = useRef(false);

  // Fase 75: se o aluno já tem cidade salva de uma busca anterior, pré-
  // preenche o formulário e já dispara a busca sozinha — só mostra o campo
  // vazio pedindo a cidade na primeira vez.
  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      const savedCity = profileQuery.data.profile.city ?? "";
      const savedState = profileQuery.data.profile.state ?? "";
      if (!userEditedRef.current) {
        setCity(savedCity);
        setState(savedState);
      }
      if (savedCity || savedState) {
        setSubmitted({ city: savedCity || undefined, state: savedState || undefined });
      }
      setHydrated(true);
    }
  }, [profileQuery.data, hydrated]);

  const saveCityMutation = useMutation({
    mutationFn: (vars: { city: string; state: string }) =>
      updateMyProfile({ city: vars.city || null, state: vars.state || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  const searchQuery = useQuery({
    queryKey: ["professionals-search", submitted?.city ?? "", submitted?.state ?? ""],
    queryFn: () => searchProfessionals(submitted),
    enabled: hydrated,
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
  const statusByPro = useMemo(
    () => new Map(requests.map((r) => [r.counterpart.id, r.status])),
    [requests]
  );

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
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmedCity = city.trim();
              setSubmitted({ city: trimmedCity || undefined, state: state || undefined });
              saveCityMutation.mutate({ city: trimmedCity, state });
            }}
          >
            <CityStateInput
              city={city}
              state={state}
              onCityChange={(v) => {
                userEditedRef.current = true;
                setCity(v);
              }}
              onStateChange={(v) => {
                userEditedRef.current = true;
                setState(v);
              }}
            />
            <Button type="submit" className="self-start">
              {t("searchButton")}
            </Button>
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
                location: submitted?.city ? t("inLocationSuffix", { location: submitted.city }) : "",
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
                className="flex flex-col gap-3"
                style={{
                  borderTopWidth: "3px",
                  borderTopColor: p.planoAssinatura === "PLUS" ? "var(--accent)" : "var(--role-personal)",
                }}
              >
                <ProfessionalCard
                  email={p.email}
                  avatarUrl={p.avatarUrl}
                  city={p.city}
                  state={p.state}
                  bio={p.bio}
                  specialties={p.specialties}
                  isPlus={p.planoAssinatura === "PLUS"}
                />
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
                {(r.counterpart.city || r.counterpart.state) && (
                  <p className="text-xs text-muted">
                    📍 {[r.counterpart.city, r.counterpart.state].filter(Boolean).join(", ")}
                  </p>
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
