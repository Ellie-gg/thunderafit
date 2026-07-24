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
