"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getBillingStatus,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

const PLANS = [
  {
    interval: "monthly" as const,
    nome: "Mensal",
    preco: "R$ 9,90",
    sufixo: "/mês",
    nota: "Cobrança mensal, cancele quando quiser.",
  },
  {
    interval: "annual" as const,
    nome: "Anual",
    preco: "R$ 95,04",
    sufixo: "/ano",
    nota: "Equivale a R$ 7,92/mês — 20% de desconto.",
    destaque: true,
  },
];

function UpgradeContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status"); // success | cancel (retorno do Stripe)

  const statusQuery = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });
  const [pendingInterval, setPendingInterval] = useState<"monthly" | "annual" | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: (interval: "monthly" | "annual") => createCheckoutSession(interval),
    onSuccess: (data) => {
      // Redireciona para o Checkout hospedado do Stripe.
      window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const isPago = statusQuery.data?.planoAssinatura === "PAGO";

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            Plano
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isPago ? "Sua assinatura" : "Fazer upgrade"}
          </h1>
          <p className="text-sm text-muted">
            {isPago
              ? "Você está no plano pago — até 50 alunos vinculados."
              : "Plano gratuito: até 3 alunos. Faça upgrade para vincular até 50."}
          </p>
        </div>

        {status === "success" && (
          <Card style={{ borderTopWidth: "4px", borderTopColor: "var(--success)" }}>
            <p className="text-sm text-success">
              Pagamento concluído! Sua assinatura está sendo ativada — pode levar alguns
              segundos para o limite atualizar.
            </p>
          </Card>
        )}
        {status === "cancel" && (
          <Card>
            <p className="text-sm text-muted">Checkout cancelado. Nenhuma cobrança foi feita.</p>
          </Card>
        )}

        {statusQuery.isError && (
          <QueryError error={statusQuery.error} onRetry={() => statusQuery.refetch()} />
        )}

        {isPago ? (
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">Gerenciar assinatura</h2>
            <p className="text-sm text-muted">
              Altere o método de pagamento, veja faturas ou cancele pelo portal seguro do
              Stripe. Ao cancelar, seus alunos já vinculados continuam — só novos vínculos
              acima de 3 ficam bloqueados após o fim do período pago.
            </p>
            {portalMutation.isError && (
              <p className="text-sm text-danger">
                {portalMutation.error instanceof ApiError
                  ? portalMutation.error.message
                  : "Não foi possível abrir o portal."}
              </p>
            )}
            <Button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="self-start"
            >
              {portalMutation.isPending ? "Abrindo..." : "Gerenciar / cancelar assinatura"}
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            {PLANS.map((plan) => (
              <Card
                key={plan.interval}
                className="flex flex-1 flex-col gap-3"
                style={
                  plan.destaque ? { borderTopWidth: "4px", borderTopColor: "var(--accent)" } : undefined
                }
              >
                <div>
                  <span className="font-display text-lg font-bold">{plan.nome}</span>
                  {plan.destaque && (
                    <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      Melhor valor
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-display text-3xl font-bold">{plan.preco}</span>
                  <span className="text-sm text-muted">{plan.sufixo}</span>
                </div>
                <p className="text-sm text-muted">{plan.nota}</p>
                <p className="text-xs text-muted">Até 50 alunos vinculados.</p>
                <Button
                  onClick={() => {
                    setPendingInterval(plan.interval);
                    checkoutMutation.mutate(plan.interval);
                  }}
                  disabled={checkoutMutation.isPending}
                  variant={plan.destaque ? "default" : "secondary"}
                  className="mt-auto"
                >
                  {checkoutMutation.isPending && pendingInterval === plan.interval
                    ? "Redirecionando..."
                    : "Assinar"}
                </Button>
              </Card>
            ))}
          </div>
        )}

        {checkoutMutation.isError && (
          <p className="text-sm text-danger">
            {checkoutMutation.error instanceof ApiError
              ? checkoutMutation.error.message
              : "Não foi possível iniciar o checkout."}
          </p>
        )}
      </main>
    </>
  );
}

export default function UpgradePage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <Suspense fallback={null}>
        <UpgradeContent />
      </Suspense>
    </AuthGuard>
  );
}
