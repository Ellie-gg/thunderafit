"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { getBillingStatus } from "@/lib/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";
import { sortByScheme, labelFor } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";
import { DeleteProgramButton } from "@/components/delete-program-button";
import { GenerateWorkoutModal } from "@/components/generate-workout-modal";

function PersonalDashboardContent() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const relationsQuery = useQuery({
    queryKey: ["relations"],
    queryFn: listRelations,
  });

  // Fase 31: era uma lista plana de sessões soltas (GET /api/workouts) sem
  // agrupar por programa — trocado por listWorkoutPrograms(), que já traz
  // `workouts` (as sessões) aninhadas em cada programa, igual o hub do aluno
  // e /personal/programas já fazem.
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal"],
    queryFn: () => listWorkoutPrograms(),
  });

  // Fase 20: o limite vem do backend (billing status), não do `user` do store
  // — que fica desatualizado após um upgrade (o plano muda via webhook do
  // Stripe, não por um novo login). Fallback ao store enquanto carrega.
  const billingQuery = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });

  const alunos = relationsQuery.data?.relations ?? [];
  const alunoEmailById = new Map(alunos.map((a) => [a.id, a.email]));
  // "Treinos prescritos" = instâncias de verdade aplicadas a um aluno —
  // templates ainda não foram prescritos a ninguém.
  const instances = (programsQuery.data?.programs ?? []).filter((p) => !p.isTemplate);
  const limite = billingQuery.data?.limiteAlunos ?? user?.limiteAlunos ?? 0;
  const isPago = billingQuery.data && billingQuery.data.planoAssinatura !== "FREE";
  const noLimite = alunos.length >= limite;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Olá, {user?.email.split("@")[0]}
          </h1>
          <p className="text-sm text-muted">Seus alunos e treinos prescritos.</p>
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              Alunos vinculados
            </span>
            <span className="font-mono-nums text-xs text-muted">
              {alunos.length}/{limite}
            </span>
          </div>
          <VoltageBar total={limite} filled={alunos.length} role="PERSONAL" />

          {noLimite && (
            <Link
              href="/personal/upgrade"
              className="block rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger hover:border-danger"
            >
              Limite de alunos atingido. <span className="font-semibold underline">Faça upgrade do plano →</span>
            </Link>
          )}

          {/* Link de upgrade sempre disponível para quem está no plano gratuito
              (mesmo antes de bater o limite). */}
          {!isPago && !noLimite && (
            <Link
              href="/personal/upgrade"
              className="text-sm font-semibold text-accent-secondary hover:underline"
            >
              Precisa de mais alunos? Ver planos →
            </Link>
          )}
          {isPago && (
            <Link
              href="/personal/upgrade"
              className="text-sm font-semibold text-accent-secondary hover:underline"
            >
              Plano {billingQuery.data!.planoAssinatura === "PLUS" ? "Plus" : "Base"} ativo · gerenciar
              assinatura →
            </Link>
          )}

          {relationsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

          {relationsQuery.isError && (
            <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {alunos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{a.email}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    desde {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  {/* Fase 29: substitui o link direto de Anamnese — agora é
                      uma seção dentro do hub do aluno, junto com programas e
                      evolução, em vez de um atalho solto. */}
                  <Link
                    href={`/personal/alunos/${a.id}`}
                    className="text-xs font-semibold text-accent-secondary hover:underline"
                  >
                    Gerenciar →
                  </Link>
                </div>
              </div>
            ))}
            {relationsQuery.isSuccess && alunos.length === 0 && (
              <p className="text-sm text-muted">Nenhum aluno vinculado ainda.</p>
            )}
          </div>

          <Button asChild variant={noLimite ? "secondary" : "default"} disabled={noLimite}>
            <Link href={noLimite ? "#" : "/personal/alunos/novo"}>
              {noLimite ? "Limite atingido" : "Vincular novo aluno"}
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              Treinos prescritos
            </span>
          </div>

          {programsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

          {programsQuery.isError && (
            <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
          )}

          <div className="flex flex-col gap-3">
            {instances.map((p) => {
              const sessions = sortByScheme(p.workouts ?? [], p.sessionScheme);
              return (
                <div key={p.id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{p.name}</span>
                      {p.alunoId && (
                        <p className="text-xs text-muted">{alunoEmailById.get(p.alunoId) ?? "aluno desvinculado"}</p>
                      )}
                    </div>
                    <DeleteProgramButton
                      programId={p.id}
                      isTemplate={false}
                      onDeleted={() =>
                        queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {sessions.map((s) => (
                      <Link key={s.id} href={`/personal/treinos/${s.id}`}>
                        <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2 transition-colors hover:border-accent">
                          <span className="text-sm">
                            <span className="font-display font-bold text-accent">
                              {labelFor(p.sessionScheme, s.letter)}
                            </span>{" "}
                            {s.name}
                          </span>
                          <span className="text-xs text-muted">Ver →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
            {programsQuery.isSuccess && instances.length === 0 && (
              <p className="text-sm text-muted">Nenhum programa aplicado a um aluno ainda.</p>
            )}
          </div>

          {/* "Montagem Inteligente": CTA principal do dashboard (antes só um
              botão secundário "Criar novo programa", pouco descoberto — o
              Personal não tinha nenhum caminho de destaque pra criar/editar
              templates a partir daqui). O motor de regras determinístico
              monta um rascunho revisável em segundos; quem prefere montar
              tudo à mão continua indo direto pra /personal/programas, sem
              nenhuma sugestão automática. */}
          <Button onClick={() => setGeneratorOpen(true)}>⚡ Gerar Treino Rápido</Button>
          <Link
            href="/personal/programas"
            className="self-start text-sm font-semibold text-accent-secondary hover:underline"
          >
            ou monte um programa do zero →
          </Link>
        </Card>

        {generatorOpen && <GenerateWorkoutModal onClose={() => setGeneratorOpen(false)} />}

        {/* Atalho visível também aqui — no celular, o link de texto do
            header fica escondido por falta de espaço. */}
        <Link
          href="/personal/duvidas"
          className="text-sm font-semibold text-accent-secondary hover:underline sm:hidden"
        >
          Ver dúvidas dos alunos →
        </Link>
      </main>
    </>
  );
}

export default function PersonalDashboardPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <PersonalDashboardContent />
    </AuthGuard>
  );
}
