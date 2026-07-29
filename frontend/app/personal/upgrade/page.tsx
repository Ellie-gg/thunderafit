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
import { useTranslations } from "next-intl";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

// Fase 87: "annual" trocado por "quarterly" — o fundador decidiu não
// oferecer mais compromisso anual, só mensal/trimestral (mesmo intervalo já
// usado pelo Aluno Premium).
type Interval = "monthly" | "quarterly";

// Fase 87: preços definidos pelo fundador (não mais placeholder de 3
// degraus da Fase 20 — Base R$14,99, Plus R$29,90, ambos com 20% off no
// trimestral, sem opção anual). Fase i18n: nome dos degraus ("Base"/"Plus")
// é tratado como nome de marca — não é traduzido entre locales (igual
// PLUS/BASE do backend). O resto vem de useTranslations() dentro de cada
// componente.

function TierCard({
  tier,
  onSubscribe,
  isPending,
}: {
  tier: PlanTier;
  onSubscribe: (tier: PlanTier, interval: Interval) => void;
  isPending: boolean;
}) {
  const t = useTranslations("personalUpgrade");
  const [interval, setInterval] = useState<Interval>("monthly");

  const TIER_INFO: Record<PlanTier, { nome: string; beneficios: string[]; destaque?: boolean }> = {
    BASE: {
      nome: "Base",
      beneficios: [t("tierBaseBeneficio1"), t("tierBaseBeneficio2")],
    },
    PLUS: {
      nome: "Plus",
      beneficios: [t("tierPlusBeneficio1"), t("tierPlusBeneficio2"), t("tierPlusBeneficio3")],
      destaque: true,
    },
  };

  const PRICES: Record<PlanTier, Record<Interval, { preco: string; sufixo: string; nota: string }>> = {
    BASE: {
      monthly: { preco: "R$ 14,99", sufixo: t("sufixoMes"), nota: t("notaMensal") },
      quarterly: { preco: "R$ 35,98", sufixo: t("sufixoTrimestre"), nota: t("notaTrimestralBase") },
    },
    PLUS: {
      monthly: { preco: "R$ 29,90", sufixo: t("sufixoMes"), nota: t("notaMensal") },
      quarterly: { preco: "R$ 71,76", sufixo: t("sufixoTrimestre"), nota: t("notaTrimestralPlus") },
    },
  };

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
            {t("maisPopular")}
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
          {t("mensal")}
        </button>
        <button
          type="button"
          onClick={() => setInterval("quarterly")}
          className={`flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors ${
            interval === "quarterly" ? "bg-accent text-ink-950" : "text-muted"
          }`}
        >
          {t("trimestral")}
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
        {isPending ? t("redirecionando") : t("assinar", { nome: info.nome })}
      </Button>
    </Card>
  );
}

function UpgradeContent() {
  const t = useTranslations("personalUpgrade");
  const intlLocale = useActiveIntlLocale();
  const searchParams = useSearchParams();
  const status = searchParams.get("status"); // success | cancel (retorno do Stripe)

  // Fase 64: `?from=templates` chega de um clique num template Premium
  // bloqueado em /personal/programas — destaca especificamente qual plano
  // libera o acesso, em vez do texto genérico de sempre.
  const from = searchParams.get("from");

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
            {t("planoEyebrow")}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isPago ? t("suaAssinatura") : t("fazerUpgradeTitulo")}
          </h1>
          <p className="text-sm text-muted">
            {isPago
              ? t("assinaturaAtivaComLimite", {
                  plano: tierNome ?? "",
                  limite: tier === "PLUS" ? t("limiteIlimitado") : t("limiteAte20"),
                })
              : t("planoGratuito")}
          </p>
          {/* Fase 93: só aparece numa concessão manual do admin com prazo
              (Fase 90) — assinatura Stripe real nunca tem essa data (é
              recorrente até cancelar, controlada pelo "Gerenciar assinatura"
              abaixo). */}
          {statusQuery.data?.planoAssinaturaExpiresAt && (
            <p className="text-xs text-muted">
              {t("planoExpiraEm", {
                date: new Date(statusQuery.data.planoAssinaturaExpiresAt).toLocaleDateString(intlLocale),
              })}
            </p>
          )}
        </div>

        {status === "success" && (
          <Card style={{ borderTopWidth: "4px", borderTopColor: "var(--success)" }}>
            <p className="text-sm text-success">{t("pagamentoConcluido")}</p>
          </Card>
        )}
        {status === "cancel" && (
          <Card>
            <p className="text-sm text-muted">{t("checkoutCancelado")}</p>
          </Card>
        )}

        {from === "templates" && tier !== "PLUS" && (
          <Card style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}>
            <p className="text-sm text-foreground">{t("avisoTemplatesPremium")}</p>
          </Card>
        )}

        {statusQuery.isError && (
          <QueryError error={statusQuery.error} onRetry={() => statusQuery.refetch()} />
        )}

        {isPago ? (
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">{t("gerenciarAssinatura")}</h2>
            <p className="text-sm text-muted">{t("gerenciarAssinaturaDescricao")}</p>
            {portalMutation.isError && (
              <p className="text-sm text-danger">
                {portalMutation.error instanceof ApiError
                  ? portalMutation.error.message
                  : t("erroAbrirPortal")}
              </p>
            )}
            <Button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="self-start"
            >
              {portalMutation.isPending ? t("abrindo") : t("gerenciarCancelarAssinatura")}
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
              : t("erroIniciarCheckout")}
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
