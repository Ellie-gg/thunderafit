import { apiFetch } from "./client";

export type PlanTier = "BASE" | "PLUS";

export interface BillingStatus {
  planoAssinatura: "FREE" | PlanTier;
  limiteAlunos: number;
  hasSubscription: boolean;
}

export function getBillingStatus() {
  return apiFetch<BillingStatus>("/api/billing/status");
}

export function createCheckoutSession(tier: PlanTier, interval: "monthly" | "annual") {
  return apiFetch<{ url: string }>("/api/billing/checkout-session", {
    method: "POST",
    body: { tier, interval },
  });
}

export function createPortalSession() {
  return apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
}

// --- Fase 56: Aluno Premium (guardrails — teste grátis; checkout real fica
// pra quando o pagamento entrar em produção) ---

export type AlunoPremiumStatusValue = "NONE" | "TRIAL" | "ACTIVE" | "CANCELED";

export interface AlunoPremiumEntitlement {
  status: AlunoPremiumStatusValue;
  hasAccess: boolean;
  premiumExpiresAt: string | null;
  trialAvailable: boolean;
}

export function getAlunoPremiumStatus() {
  return apiFetch<AlunoPremiumEntitlement>("/api/billing/aluno/premium-status");
}

export function startAlunoPremiumTrial() {
  return apiFetch<AlunoPremiumEntitlement>("/api/billing/aluno/trial", { method: "POST" });
}
