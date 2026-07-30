import { apiFetch } from "./client";

export type PlanTier = "BASE" | "PLUS";

export interface BillingStatus {
  planoAssinatura: "FREE" | PlanTier;
  limiteAlunos: number;
  hasSubscription: boolean;
  // Fase 93: só preenchido numa concessão manual do admin com prazo (Fase
  // 90) — assinatura real via Stripe nunca tem data-limite fixa aqui (é
  // recorrente até cancelar, ver "Gerenciar assinatura").
  planoAssinaturaExpiresAt: string | null;
  // Fase 103: excesso de alunos vinculados em relação ao limiteAlunos atual
  // (downgrade/cancelamento/expiração) — ver src/lib/plan-expiry.ts no
  // backend pro raciocínio completo.
  overLimiteAlunos: boolean;
  /** true = já passou a carência, prescrição está bloqueada. */
  overLimiteAlunosBlocked: boolean;
  /** Dias restantes de carência, ou null (dentro do limite, ou já bloqueado). */
  overLimiteAlunosGraceDaysLeft: number | null;
}

export function getBillingStatus() {
  return apiFetch<BillingStatus>("/api/billing/status");
}

// Fase 87: "annual" trocado por "quarterly" — sem compromisso anual.
export function createCheckoutSession(tier: PlanTier, interval: "monthly" | "quarterly") {
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
