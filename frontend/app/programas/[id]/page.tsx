"use client";

import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkoutProgram, addSelfProgramSession } from "@/lib/api/workouts";
import { getAlunoPremiumStatus } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import type { WorkoutProgram } from "@/lib/types";
import { sortByScheme, labelFor, firstMissingKey, maxSessionsFor } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { DeleteProgramButton } from "@/components/delete-program-button";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

function formatDate(iso: string | null, intlLocale: string, neverCompletedLabel: string): string {
  if (!iso) return neverCompletedLabel;
  return new Date(iso).toLocaleDateString(intlLocale);
}

function ProgramaContent() {
  const t = useTranslations("programaDetail");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const programId = params.id;
  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
    // Perf (Grupo Y, item 106): a lista em /programas já trouxe este mesmo
    // programa (sem `suggestedNext` nem `exercises` por sessão — só o
    // detalhe computa/inclui isso, e ambos já são lidos aqui atrás de
    // guards seguros). Semeando o cache com o item da lista, a navegação
    // lista→detalhe renderiza na hora em vez de piscar um loading.
    placeholderData: () => {
      const list = queryClient.getQueryData<{ programs: WorkoutProgram[] }>([
        "workout-programs",
        "aluno",
      ]);
      const match = list?.programs.find((p) => p.id === programId);
      return match ? { program: match } : undefined;
    },
  });

  // F7 (auditoria 2026-07-31): editar o treino pessoal é um recurso do Aluno
  // Premium (o backend já bloqueia com 402 em qualquer mutação) — mas esta
  // tela mostrava os controles de edição (✏️, "Adicionar treino") pra
  // QUALQUER aluno com um programa `origin: SELF`, mesmo sem Premium (os
  // carrosséis GRATUITOS "Treino em Casa"/"Treinos Prontos" também aplicam
  // instâncias `origin: SELF`). Resultado: aluno gratuito via os botões,
  // clicava, e todos os cliques falhavam com 402 sem nenhuma explicação de
  // que é recurso pago. A mesma tela em `/meu-treino-pessoal` já faz essa
  // checagem — só faltava aqui.
  const premiumStatusQuery = useQuery({
    queryKey: ["aluno-premium-status"],
    queryFn: getAlunoPremiumStatus,
  });

  const program = programQuery.data?.program;
  const scheme = program?.sessionScheme ?? "LETTER";
  const sessions = sortByScheme(program?.workouts ?? [], scheme);
  // Fase 85: só um treino origin: SELF pode ser editado pelo próprio aluno
  // (montado do zero OU um template aplicado — as duas origens viram o MESMO
  // tipo de registro, então a edição vale pras duas igual). O treino
  // PRESCRITO pelo Personal (origin: PERSONAL) nunca ganha estes controles.
  const isSelfProgram = program?.origin === "SELF";
  const canEdit = isSelfProgram && !!premiumStatusQuery.data?.hasAccess;
  const nextKey = firstMissingKey(scheme, sessions.map((s) => s.letter));
  const canAddSession = canEdit && sessions.length < maxSessionsFor(scheme) && !!nextKey;

  const addSessionMutation = useMutation({
    mutationFn: (letter: string) => addSelfProgramSession(programId, { letter }),
    onSuccess: (data) => {
      // Fr3 (auditoria 2026-07-31): faltava invalidar ["workout-program",
      // programId] antes do push — a página de destino usa a MESMA
      // queryKey, e como ela fica fresh por 30s (staleTime), chegava lá sem
      // refetch e não achava a sessão recém-criada na lista ainda velha em
      // cache, caindo em "sessão não encontrada". A tela de destino e a
      // tela irmã do Personal já invalidam antes do push — só esta ficou
      // de fora.
      queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });
      router.push(`/meu-treino-pessoal/${programId}/sessoes/${data.session.id}`);
    },
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("programLabel")}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{program.name}</h1>
              {program.description && (
                <p className="text-xs text-muted">{program.description}</p>
              )}
              <p className="text-sm text-muted">
                {t("sessionCountSubtitle", { count: sessions.length })}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Link href={`/treinos/${s.id}`} className="flex-1">
                    <Card
                      className="flex items-center justify-between transition-colors hover:border-accent"
                      style={s.suggestedNext ? { borderColor: "var(--accent)" } : undefined}
                    >
                      <div>
                        <span className="font-display text-lg font-bold text-accent">
                          {labelFor(scheme, s.letter)}
                        </span>{" "}
                        <span className="font-semibold">{s.name}</span>
                        <p className="text-xs text-muted">
                          {t("lastCompleted", {
                            date: formatDate(s.lastCompletedAt, intlLocale, t("neverCompleted")),
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {s.suggestedNext && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                            {t("suggested")}
                          </span>
                        )}
                        <span className="text-sm text-muted">{t("open")}</span>
                      </div>
                    </Card>
                  </Link>
                  {/* Fase 85: editar só existe pra um treino origin: SELF do
                      próprio aluno — nunca aparece no prescrito pelo
                      Personal. Link separado (não aninhado no Card acima)
                      pra não colocar uma âncora dentro da outra. */}
                  {canEdit && (
                    <Link
                      href={`/meu-treino-pessoal/${programId}/sessoes/${s.id}`}
                      aria-label={t("editSessionAriaLabel", { label: labelFor(scheme, s.letter) })}
                      className="shrink-0 rounded-md border border-border p-2.5 text-sm hover:border-accent"
                    >
                      ✏️
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {isSelfProgram && (
              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
                {/* Remover nunca é bloqueado por Premium (mesma filosofia já
                    usada nos gates de plano/limite — só o que EXPANDE a
                    prescrição é gated), então fica fora de `canEdit`. */}
                {canAddSession && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    disabled={addSessionMutation.isPending}
                    onClick={() => addSessionMutation.mutate(nextKey!)}
                  >
                    {addSessionMutation.isPending
                      ? t("addingSession")
                      : t("addSessionButton", { label: labelFor(scheme, nextKey!) })}
                  </Button>
                )}
                <DeleteProgramButton
                  programId={programId}
                  isTemplate={false}
                  onDeleted={() => router.push("/meu-treino-pessoal")}
                />
              </div>
            )}
            {addSessionMutation.isError && (
              // Fr15 (auditoria 2026-07-31): texto genérico fixo escondia a
              // mensagem real do backend — ex: 402 "Editar seu treino
              // pessoal é um recurso do Aluno Premium..." nunca aparecia,
              // então um aluno gratuito via só "Erro ao adicionar sessão",
              // sem nenhuma pista de que é um recurso pago.
              <p className="text-sm text-danger">
                {addSessionMutation.error instanceof ApiError
                  ? addSessionMutation.error.message
                  : t("addSessionError")}
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function ProgramaPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <ProgramaContent />
    </AuthGuard>
  );
}
