import { apiFetch } from "./client";

export interface BillingStatus {
  planoAssinatura: "FREE" | "PAGO";
  limiteAlunos: number;
  hasSubscription: boolean;
}

export function getBillingStatus() {
  return apiFetch<BillingStatus>("/api/billing/status");
}

export function createCheckoutSession(interval: "monthly" | "annual") {
  return apiFetch<{ url: string }>("/api/billing/checkout-session", {
    method: "POST",
    body: { interval },
  });
}

export function createPortalSession() {
  return apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
}
