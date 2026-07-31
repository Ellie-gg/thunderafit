"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { getBillingStatus } from "@/lib/api/billing";
import { listThreads } from "@/lib/api/support";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";
import { useTranslations } from "next-intl";

/**
 * Fase 66 — dashboard redesenhado a partir de um mockup do fundador: fica
 * mais enxuto, 2 cards de ação clara em vez do misto de "alunos + criar
 * treino" espalhado. "Montagem Inteligente" saiu daqui (mudou pra dentro de
 * /personal/programas, junto do formulário manual de criar template) — o
 * dashboard não é mais o único lugar pra criar um treino do zero.
 */
function PersonalDashboardContent() {
  const t = useTranslations("personalDashboard");
  const tc = useTranslations("common");
  const user = useAuthStore((s) => s.user);

  const relationsQuery = useQuery({
    queryKey: ["relations"],
    queryFn: listRelations,
  });

  // Fase 20: o limite vem do backend (billing status), não do `user` do store
  // — que fica desatualizado após um upgrade (o plano muda via webhook do
  // Stripe, não por um novo login). Fallback ao store enquanto carrega.
  const billingQuery = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });

  // Fase 66: "Dúvidas de alunos (N pendentes)" — reaproveita a MESMA listagem
  // que /personal/duvidas já usa (sem endpoint novo), contando client-side
  // as threads com status ABERTO (= aguardando resposta do Personal).
  const threadsQuery = useQuery({ queryKey: ["support-threads"], queryFn: listThreads });
  const pendingThreads = (threadsQuery.data?.threads ?? []).filter((th) => th.status === "ABERTO").length;

  const alunos = relationsQuery.data?.relations ?? [];
  const limite = billingQuery.data?.limiteAlunos ?? user?.limiteAlunos ?? 0;
  const isPago = billingQuery.data && billingQuery.data.planoAssinatura !== "FREE";
  // Fase 65: plano Plus é "ilimitado" (limiteAlunos = 1_000_000 no backend,
  // só um sentinel) — mostrar "X/1000000" ou uma barra quase toda vazia não
  // faz sentido nenhum pro Personal, então o bloco de contagem some por
  // completo pra esse plano.
  const isPlus = billingQuery.data?.planoAssinatura === "PLUS";
  const noLimite = !isPlus && alunos.length >= limite;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("greeting", { nome: user?.email.split("@")[0] ?? "" })}
          </h1>
          {/* Fase 66: selo de plano ativo logo abaixo da saudação (antes só
              aparecia como um link de texto dentro do card de alunos). */}
          {billingQuery.data && (
            <Link
              href="/personal/upgrade"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent hover:border-accent"
            >
              {isPago ? (
                <>⚡ {t("planoAtivoBadge", { plano: isPlus ? "Plus" : "Base" })}</>
              ) : (
                t("verPlanos")
              )}
            </Link>
          )}
        </div>

        {/* Card 1: Biblioteca de Templates */}
        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">📋 {t("templateLibraryTitle")}</h2>
            <p className="text-sm text-muted">{t("templateLibraryDescription")}</p>
          </div>
          <Button asChild>
            <Link href="/personal/programas">⚡ {t("exploreTemplates")}</Link>
          </Button>
          <Link
            href="/personal/programas?criar=1"
            className="self-start text-sm font-semibold text-accent-secondary hover:underline"
          >
            {t("montarDoZero")}
          </Link>
        </Card>

        {/* Card 2: Meus Alunos */}
        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">👥 {t("myStudentsTitle")}</h2>
            <p className="text-sm text-muted">{t("myStudentsDescription")}</p>
          </div>

          <Button asChild variant="secondary" disabled={noLimite}>
            <Link href={noLimite ? "#" : "/personal/alunos/novo"}>
              {noLimite ? t("limiteAtingidoBotao") : t("vincularNovoAluno")}
            </Link>
          </Button>

          {noLimite && (
            <Link
              href="/personal/upgrade"
              className="block rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger hover:border-danger"
            >
              {t("limiteAtingido")} <span className="font-semibold underline">{t("fazerUpgrade")}</span>
            </Link>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("alunosVinculados")}
              </span>
              {!isPlus && (
                <span className="font-mono-nums text-xs text-muted">
                  {alunos.length}/{limite}
                </span>
              )}
            </div>
            {isPlus ? (
              <p className="text-sm text-muted">{t("alunosIlimitados")}</p>
            ) : (
              <VoltageBar total={limite} filled={alunos.length} role="PERSONAL" />
            )}

            {relationsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
            {relationsQuery.isError && (
              <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
            )}
            {relationsQuery.isSuccess && alunos.length === 0 && (
              <p className="text-sm text-muted">{t("nenhumAlunoVinculado")}</p>
            )}
            {relationsQuery.isSuccess && alunos.length > 0 && (
              <Link
                href="/personal/alunos"
                className="text-sm font-semibold text-accent-secondary hover:underline"
              >
                {t("gerenciarAlunos")}
              </Link>
            )}
          </div>

          {/* Fase 66: acesso rápido embutido no card — antes era só um link
              escondido no header/atalho mobile. */}
          <Link
            href="/personal/duvidas"
            className="rounded-md border border-border px-3 py-2 text-sm hover:border-accent"
          >
            💬{" "}
            {pendingThreads > 0
              ? t("duvidasAlunosPendentes", { count: pendingThreads })
              : t("duvidasAlunos")}
          </Link>
          {/* Fr13 (auditoria 2026-07-31): sem isto, uma falha aqui só fazia
              o atalho assumir silenciosamente "0 pendentes" — o Personal
              interpretava como "nenhuma dúvida em aberto" quando na
              verdade a contagem não carregou. */}
          {threadsQuery.isError && (
            <p className="text-xs text-danger">{t("duvidasCountError")}</p>
          )}
        </Card>
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
