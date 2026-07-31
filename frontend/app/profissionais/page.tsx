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
import { ConversationThread } from "@/components/conversation-thread";

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
    // Fr2 (auditoria 2026-07-31): se `profileQuery` falhar, `hydrated` nunca
    // virava `true` (só o `if` acima cobria o caminho de sucesso) — como
    // `searchQuery` abaixo é `enabled: hydrated`, a busca nunca destravava:
    // sem loading, sem erro, sem "nada encontrado", o clique em "Buscar"
    // literalmente não fazia nada, pra sempre. Sem cidade salva pra
    // pré-preencher, mas ainda destrava a busca manual.
    if (profileQuery.isError && !hydrated) {
      setHydrated(true);
    }
  }, [profileQuery.data, profileQuery.isError, hydrated]);

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

  // Fase 76: "Solicitar vínculo" virou "Enviar mensagem" — abre uma caixa de
  // composição inline no card em vez de disparar um clique cego; a 1ª
  // mensagem é o que cria a solicitação.
  const [composingId, setComposingId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: (vars: { professionalId: string; message: string }) =>
      createConnectionRequest(vars.professionalId, vars.message),
    onSuccess: () => {
      setComposingId(null);
      setMessageDraft("");
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
            {saveCityMutation.isError && (
              // Fr13/C8 (auditoria 2026-07-31): sem `onError`/render nenhum
              // — a busca rodava normalmente mesmo com a cidade não
              // persistindo, e na próxima visita o campo voltava vazio sem
              // nenhum aviso do motivo.
              <p className="text-sm text-danger">
                {saveCityMutation.error instanceof ApiError
                  ? saveCityMutation.error.message
                  : t("connectionError")}
              </p>
            )}
          </form>
        </Card>

        {requestsQuery.isError && (
          // Fr13 (auditoria 2026-07-31): sem isso, `statusByPro` ficava
          // vazio em silêncio e o botão "Enviar mensagem" reaparecia pra
          // profissionais que já têm solicitação em andamento — um 409
          // inesperado no envio.
          <p className="text-sm text-danger">{t("connectionError")}</p>
        )}

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
                ) : composingId === p.id ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (messageDraft.trim()) {
                        requestMutation.mutate({ professionalId: p.id, message: messageDraft.trim() });
                      }
                    }}
                  >
                    <textarea
                      autoFocus
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      rows={2}
                      placeholder={t("messagePlaceholder")}
                      className="resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={requestMutation.isPending || !messageDraft.trim()}
                      >
                        {requestMutation.isPending ? t("sending") : t("sendMessage")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setComposingId(null);
                          setMessageDraft("");
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                    {requestMutation.isError && requestMutation.variables?.professionalId === p.id && (
                      <p className="text-xs text-danger">
                        {requestMutation.error instanceof ApiError
                          ? requestMutation.error.message
                          : t("sendRequestError")}
                      </p>
                    )}
                  </form>
                ) : (
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={() => {
                      setComposingId(p.id);
                      setMessageDraft("");
                    }}
                  >
                    {t("sendMessage")}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="font-display text-lg font-bold">{t("myRequests")}</h2>
          {requestsQuery.isSuccess && requests.length === 0 && (
            <p className="text-sm text-muted">{t("noRequestsSent")}</p>
          )}
          {requests.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center justify-between text-left"
                onClick={() => setExpandedRequestId((cur) => (cur === r.id ? null : r.id))}
              >
                <div>
                  <p className="font-semibold">{r.counterpart.email.split("@")[0]}</p>
                  {(r.counterpart.city || r.counterpart.state) && (
                    <p className="text-xs text-muted">
                      📍 {[r.counterpart.city, r.counterpart.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </button>
              {expandedRequestId === r.id && (
                <ConversationThread requestId={r.id} closed={r.status === "RECUSADA"} />
              )}
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
