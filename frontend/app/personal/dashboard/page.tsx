"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { getBillingStatus } from "@/lib/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";
import { GenerateWorkoutModal } from "@/components/generate-workout-modal";
import { useTranslations } from "next-intl";

function PersonalDashboardContent() {
  const t = useTranslations("personalDashboard");
  const tc = useTranslations("common");
  const user = useAuthStore((s) => s.user);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const relationsQuery = useQuery({
    queryKey: ["relations"],
    queryFn: listRelations,
  });

  // Fase 20: o limite vem do backend (billing status), não do `user` do store
  // — que fica desatualizado após um upgrade (o plano muda via webhook do
  // Stripe, não por um novo login). Fallback ao store enquanto carrega.
  const billingQuery = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });

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

          {/* Fase 62: a lista completa de alunos (email a email) saiu daqui —
              agora vive só na tela "Gerenciar alunos", que também mostra o
              status de treino de cada um. Aqui fica só a contagem/limite. */}
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

          <Button asChild variant={noLimite ? "secondary" : "default"} disabled={noLimite}>
            <Link href={noLimite ? "#" : "/personal/alunos/novo"}>
              {noLimite ? t("limiteAtingidoBotao") : t("vincularNovoAluno")}
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("templatesDeTreino")}
            </span>
          </div>

          {/* Fase 62: a lista de instâncias (treinos já prescritos a cada
              aluno) saiu daqui — cada uma só se vê dentro do hub do próprio
              aluno agora. O link "montar do zero" abaixo já leva pra
              /personal/programas, agora a biblioteca completa de templates
              (Meus/Básico/Premium) — sem precisar de um 2º link repetido
              pro mesmo destino. */}

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
