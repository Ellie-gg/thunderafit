"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAlunoPremiumStatus, startAlunoPremiumTrial } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Fase 85 — card de upsell do Aluno Premium (dashboard + "Meu treino
 * pessoal"). Auto-contido: busca o próprio status (`["aluno-premium-status"]`
 * — mesma query key já usada no resto do app, então o React Query dedupe
 * entre instâncias sem refetch extra) e cuida do teste grátis sozinho. Só
 * renderiza algo quando o aluno REALMENTE não tem acesso — quem usa decide
 * se/quando montar o componente (ex: só depois que a query carregou).
 */
export function PremiumUpsellCard() {
  const t = useTranslations("premiumUpsellCard");
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["aluno-premium-status"], queryFn: getAlunoPremiumStatus });

  const trialMutation = useMutation({
    mutationFn: startAlunoPremiumTrial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-premium-status"] });
    },
  });

  if (!statusQuery.data || statusQuery.data.hasAccess) return null;

  return (
    <Card
      className="flex flex-col items-center gap-3 text-center"
      style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          🔒
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-accent">{t("eyebrow")}</span>
      </div>

      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">{t("headline")}</h2>

      <div className="flex flex-col items-start gap-1 self-stretch text-sm text-muted">
        <p className="mb-1 self-center font-semibold text-foreground">{t("benefitsIntro")}</p>
        <p>✓ {t("benefit1")}</p>
        <p>✓ {t("benefit2")}</p>
        <p>✓ {t("benefit3")}</p>
      </div>

      {statusQuery.data.trialAvailable ? (
        <Button
          type="button"
          variant="secondary"
          disabled={trialMutation.isPending}
          onClick={() => trialMutation.mutate()}
          className="mt-1 self-stretch border-2 border-dashed border-accent text-accent hover:bg-accent/10"
        >
          {trialMutation.isPending ? t("startingTrial") : t("startTrialButton")}
        </Button>
      ) : (
        <p className="mt-1 text-sm text-muted">{t("comingSoon")}</p>
      )}

      {trialMutation.isError && (
        <p className="text-sm text-danger">
          {trialMutation.error instanceof ApiError ? trialMutation.error.message : t("trialError")}
        </p>
      )}
    </Card>
  );
}
