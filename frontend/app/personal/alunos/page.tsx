"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { listClientInvites } from "@/lib/api/client-invites";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { RemoveAlunoButton } from "@/components/remove-aluno-button";
import { RevokeInviteButton } from "@/components/revoke-invite-button";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { useTranslations } from "next-intl";

/**
 * Fase 62 — "Gerenciar alunos": a lista completa de alunos vinculados saiu
 * do dashboard (que agora só mostra a contagem/limite) e ganhou uma tela
 * própria, com um selo de "sem treino aplicado" por aluno — a mesma
 * visibilidade que a lista antiga do dashboard dava, sem poluir a tela
 * principal. Cada card abre o hub já existente (`/personal/alunos/[id]`),
 * sem mudança nenhuma ali.
 */
function GerenciarAlunosContent() {
  const t = useTranslations("personalAlunosList");
  const tc = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const queryClient = useQueryClient();

  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });
  // F10 (auditoria 2026-07-31): esta tela só usa INSTÂNCIAS aplicadas (pra
  // saber quem tem treino) — pedir só `type: "instance"` no servidor evita
  // competir pelo mesmo cap defensivo com os templates do Personal (ver
  // comentário equivalente em app/personal/programas/page.tsx).
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal", "instance"],
    queryFn: () => listWorkoutPrograms("instance"),
  });
  // Fase 104: convites ainda não consumidos (inclui expirados de propósito
  // — ver comentário em client-invites.repository.ts#findActiveByPersonal).
  const invitesQuery = useQuery({ queryKey: ["client-invites"], queryFn: listClientInvites });

  const alunos = relationsQuery.data?.relations ?? [];
  const alunoIdsComTreino = new Set(
    (programsQuery.data?.programs ?? []).filter((p) => !p.isTemplate && p.alunoId).map((p) => p.alunoId)
  );

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-muted">{t("subtitulo")}</p>
        </div>

        {relationsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
        {relationsQuery.isError && (
          <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
        )}

        {/* Fase 104 — convites pendentes: só aparece a seção se houver
            algum, pra não poluir a tela de quem não tem nenhum convite em
            aberto. */}
        {(invitesQuery.data?.invites.length ?? 0) > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("convitesPendentes")}
            </h2>
            {invitesQuery.data!.invites.map((invite) => {
              const expired = new Date(invite.expiresAt).getTime() < Date.now();
              return (
                <Card key={invite.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{invite.label}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        expired ? "border-danger/40 text-danger" : "border-border text-muted"
                      }`}
                    >
                      {expired ? t("conviteExpirado") : t("convitePendente")}
                    </span>
                  </div>
                  <RevokeInviteButton
                    inviteId={invite.id}
                    onRevoked={() => queryClient.invalidateQueries({ queryKey: ["client-invites"] })}
                  />
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {alunos.map((a) => (
            <Link key={a.id} href={`/personal/alunos/${a.id}`}>
              <Card className="flex items-center justify-between gap-3 transition-colors hover:border-accent">
                {/* min-w-0 + break-all: sem isso, um e-mail longo não quebra
                    linha e empurra o grupo da direita pra fora do card. */}
                <div className="min-w-0 flex-1">
                  <span className="block truncate break-all text-sm font-semibold">{a.email}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">
                      {t("desde", { data: new Date(a.createdAt).toLocaleDateString(intlLocale) })}
                    </span>
                    {!alunoIdsComTreino.has(a.id) && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {t("semTreino")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RemoveAlunoButton
                    alunoId={a.id}
                    onRemoved={() => {
                      queryClient.invalidateQueries({ queryKey: ["relations"] });
                      // Fase 103: também invalida o billing-status — desvincular
                      // pode fazer o Personal voltar pra dentro do limite, e o
                      // banner de carência (AppHeader) precisa refletir isso na
                      // hora, não só na próxima navegação.
                      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
                    }}
                  />
                  <span className="text-sm text-muted">{t("gerenciar")}</span>
                </div>
              </Card>
            </Link>
          ))}
          {relationsQuery.isSuccess && alunos.length === 0 && (
            <p className="text-sm text-muted">{t("nenhumAlunoVinculado")}</p>
          )}
        </div>
      </main>
    </>
  );
}

export default function GerenciarAlunosPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <GerenciarAlunosContent />
    </AuthGuard>
  );
}
