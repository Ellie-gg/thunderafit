"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { getBillingStatus } from "@/lib/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";
import { DeleteProgramButton } from "@/components/delete-program-button";
import { GenerateWorkoutModal } from "@/components/generate-workout-modal";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { useTranslations } from "next-intl";

function PersonalDashboardContent() {
  const t = useTranslations("personalDashboard");
  const tc = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
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
            {t("greeting", { nome: user?.email.split("@")[0] ?? "" })}
          </h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("alunosVinculados")}
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
              {t("limiteAtingido")} <span className="font-semibold underline">{t("fazerUpgrade")}</span>
            </Link>
          )}

          {/* Link de upgrade sempre disponível para quem está no plano gratuito
              (mesmo antes de bater o limite). */}
          {!isPago && !noLimite && (
            <Link
              href="/personal/upgrade"
              className="text-sm font-semibold text-accent-secondary hover:underline"
            >
              {t("verPlanos")}
            </Link>
          )}
          {isPago && (
            <Link
              href="/personal/upgrade"
              className="text-sm font-semibold text-accent-secondary hover:underline"
            >
              {t("planoAtivo", {
                plano: billingQuery.data!.planoAssinatura === "PLUS" ? "Plus" : "Base",
              })}
            </Link>
          )}

          {relationsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}

          {relationsQuery.isError && (
            <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {alunos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                {/* min-w-0 + break-all: sem isso, um e-mail longo não quebra
                    linha (string sem espaços) e empurra o grupo da direita
                    pra fora do card — mesmo padrão do hub do aluno. */}
                <span className="min-w-0 flex-1 break-all text-sm">{a.email}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted">
                    {t("desde", { data: new Date(a.createdAt).toLocaleDateString(intlLocale) })}
                  </span>
                  {/* Fase 29: substitui o link direto de Anamnese — agora é
                      uma seção dentro do hub do aluno, junto com programas e
                      evolução, em vez de um atalho solto. */}
                  <Link
                    href={`/personal/alunos/${a.id}`}
                    className="text-xs font-semibold text-accent-secondary hover:underline"
                  >
                    {t("gerenciar")}
                  </Link>
                </div>
              </div>
            ))}
            {relationsQuery.isSuccess && alunos.length === 0 && (
              <p className="text-sm text-muted">{t("nenhumAlunoVinculado")}</p>
            )}
          </div>

          <Button asChild variant={noLimite ? "secondary" : "default"} disabled={noLimite}>
            <Link href={noLimite ? "#" : "/personal/alunos/novo"}>
              {noLimite ? t("limiteAtingidoBotao") : t("vincularNovoAluno")}
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("treinosPrescritos")}
            </span>
          </div>

          {programsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}

          {programsQuery.isError && (
            <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
          )}

          {/* Só o nome do programa + quantas sessões tem — clicar nele abre a
              tela própria do programa (/personal/programas/[id]), onde cada
              dia/letra é editado individualmente. Antes cada card já vinha
              com TODAS as sessões expandidas inline aqui mesmo, duplicando o
              que aquela tela já mostra bem e deixando o dashboard poluído
              com vários alunos vinculados. */}
          <div className="flex flex-col gap-3">
            {instances.map((p) => (
              <Link key={p.id} href={`/personal/programas/${p.id}`}>
                <Card className="flex items-center justify-between gap-3 transition-colors hover:border-accent">
                  {/* min-w-0 pra truncate funcionar dentro do flex row — sem
                      isso, um nome de programa ou e-mail longo empurra o
                      grupo de ações pra fora do card. */}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <p className="truncate text-xs text-muted">
                      {p.alunoId ? alunoEmailById.get(p.alunoId) ?? t("alunoDesvinculado") : "—"} ·{" "}
                      {t("sessoesCount", { count: p.workouts?.length ?? 0 })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DeleteProgramButton
                      programId={p.id}
                      isTemplate={false}
                      onDeleted={() =>
                        queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] })
                      }
                    />
                    <span className="text-sm text-muted">{t("abrir")}</span>
                  </div>
                </Card>
              </Link>
            ))}
            {programsQuery.isSuccess && instances.length === 0 && (
              <p className="text-sm text-muted">{t("nenhumProgramaAplicado")}</p>
            )}
          </div>

          {/* "Montagem Inteligente": CTA principal do dashboard (antes só um
              botão secundário "Criar novo programa", pouco descoberto — o
              Personal não tinha nenhum caminho de destaque pra criar/editar
              templates a partir daqui). O motor de regras determinístico
              monta um rascunho revisável em segundos; quem prefere montar
              tudo à mão continua indo direto pra /personal/programas, sem
              nenhuma sugestão automática. */}
          <Button onClick={() => setGeneratorOpen(true)}>{t("gerarTreinoRapido")}</Button>
          <Link
            href="/personal/programas"
            className="self-start text-sm font-semibold text-accent-secondary hover:underline"
          >
            {t("montarDoZero")}
          </Link>
        </Card>

        {generatorOpen && <GenerateWorkoutModal onClose={() => setGeneratorOpen(false)} />}

        {/* Atalho visível também aqui — no celular, o link de texto do
            header fica escondido por falta de espaço. */}
        <Link
          href="/personal/duvidas"
          className="text-sm font-semibold text-accent-secondary hover:underline sm:hidden"
        >
          {t("verDuvidas")}
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
