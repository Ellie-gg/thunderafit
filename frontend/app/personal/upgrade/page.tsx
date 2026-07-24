"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getBillingStatus,
  createCheckoutSession,
  createPortalSession,
  type PlanTier,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

type Interval = "monthly" | "annual";

// Billing 3 degraus: valores em R$ são PLACEHOLDER (o que importa nesta fase
// é a estrutura de degraus e o filtro do diretório, não o preço final).
const TIER_INFO: Record<
  PlanTier,
  { nome: string; limiteLabel: string; beneficios: string[]; destaque?: boolean }
> = {
  BASE: {
    nome: "Base",
    limiteLabel: "Até 20 alunos vinculados",
    beneficios: ["Até 20 alunos vinculados", "Apareça no diretório de profissionais"],
  },
  PLUS: {
    nome: "Plus",
    limiteLabel: "Alunos ilimitados",
    beneficios: [
      "Alunos ilimitados",
      "Destaque e prioridade no diretório de profissionais",
    ],
    destaque: true,
  },
};

const PRICES: Record<PlanTier, Record<Interval, { preco: string; sufixo: string; nota: string }>> = {
  BASE: {
    monthly: { preco: "R$ 19,90", sufixo: "/mês", nota: "Cobrança mensal, cancele quando quiser." },
    annual: {
      preco: "R$ 190,80",
      sufixo: "/ano",
      nota: "Equivale a R$ 15,90/mês — 20% de desconto.",
    },
  },
  PLUS: {
    monthly: { preco: "R$ 39,90", sufixo: "/mês", nota: "Cobrança mensal, cancele quando quiser." },
    annual: {
      preco: "R$ 382,80",
      sufixo: "/ano",
      nota: "Equivale a R$ 31,90/mês — 20% de desconto.",
    },
  },
};

function TierCard({
  tier,
  onSubscribe,
  isPending,
}: {
  tier: PlanTier;
  onSubscribe: (tier: PlanTier, interval: Interval) => void;
  isPending: boolean;
}) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const info = TIER_INFO[tier];
  const price = PRICES[tier][interval];

  return (
    <Card
      className="flex flex-1 flex-col gap-3"
      style={info.destaque ? { borderTopWidth: "4px", borderTopColor: "var(--accent)" } : undefined}
    >
      <div>
        <span className="font-display text-lg font-bold">{info.nome}</span>
        {info.destaque && (
          <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
            Mais popular
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1 text-sm text-muted">
        {info.beneficios.map((b) => (
          <li key={b}>✓ {b}</li>
        ))}
      </ul>

      <div className="flex gap-1.5 rounded-md border border-border p-1">
        <button
          type="button"
          onClick={() => setInterval("monthly")}
          className={`flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors ${
            interval === "monthly" ? "bg-accent text-ink-950" : "text-muted"
          }`}
        >
          Mensal
        </button>
        <button
          type="button"
          onClick={() => setInterval("annual")}
          className={`flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors ${
            interval === "annual" ? "bg-accent text-ink-950" : "text-muted"
          }`}
        >
          Anual
        </button>
      </div>

      <div>
        <span className="font-display text-3xl font-bold">{price.preco}</span>
        <span className="text-sm text-muted">{price.sufixo}</span>
      </div>
      <p className="text-sm text-muted">{price.nota}</p>

      <Button
        onClick={() => onSubscribe(tier, interval)}
        disabled={isPending}
        variant={info.destaque ? "default" : "secondary"}
        className="mt-auto"
      >
        {isPending ? "Redirecionando..." : `Assinar ${info.nome}`}
      </Button>
    </Card>
  );
}

function UpgradeContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status"); // success | cancel (retorno do Stripe)

  const statusQuery = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });

  const checkoutMutation = useMutation({
    mutationFn: ({ tier, interval }: { tier: PlanTier; interval: Interval }) =>
      createCheckoutSession(tier, interval),
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

  const tier = statusQuery.data?.planoAssinatura;
  const isPago = !!tier && tier !== "FREE";
  const tierNome = tier === "PLUS" ? "Plus" : tier === "BASE" ? "Base" : null;

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
              ? `Você está no plano ${tierNome} — ${
                  tier === "PLUS" ? "alunos ilimitados" : "até 20 alunos vinculados"
                }.`
              : "Plano gratuito: até 3 alunos. Faça upgrade para vincular mais e aparecer no diretório de profissionais."}
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
              Altere o método de pagamento, veja faturas, troque de degrau ou cancele pelo
              portal seguro do Stripe. Ao cancelar, seus alunos já vinculados continuam — só
              novos vínculos acima do limite do plano gratuito ficam bloqueados após o fim do
              período pago.
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
            <TierCard
              tier="BASE"
              onSubscribe={(t, i) => checkoutMutation.mutate({ tier: t, interval: i })}
              isPending={checkoutMutation.isPending && checkoutMutation.variables?.tier === "BASE"}
            />
            <TierCard
              tier="PLUS"
              onSubscribe={(t, i) => checkoutMutation.mutate({ tier: t, interval: i })}
              isPending={checkoutMutation.isPending && checkoutMutation.variables?.tier === "PLUS"}
            />
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
