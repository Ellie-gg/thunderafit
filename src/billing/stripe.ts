import Stripe from "stripe";

/**
 * Cliente Stripe (Fase 20). Instanciado de forma lazy para não exigir
 * STRIPE_SECRET_KEY no boot de ambientes que não usam billing (ex: alguns
 * testes). A verificação de assinatura do webhook (constructEvent) é
 * criptografia local (HMAC) e não faz chamada à API — só precisa do
 * webhook secret; a secret key aqui pode ser um valor de teste.
 */
let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY não configurada.");
    }
    // apiVersion omitida de propósito: usa a versão fixada na conta, evitando
    // divergência entre versão do SDK e da conta.
    stripe = new Stripe(key);
  }
  return stripe;
}

// Só para testes resetarem o singleton entre casos.
export function _resetStripeForTests(): void {
  stripe = null;
}

// Planos: 3 degraus (evolução do antigo FREE/PAGO de 2 estados). PLUS não é
// "sem limite" de verdade no schema (Int não representa infinito) — usa um
// teto alto o bastante pra nunca ser alcançado na prática, reaproveitando a
// MESMA checagem numérica (`count >= limiteAlunos`) já usada em
// relations.service.ts, sem precisar de um caminho de código à parte para
// "ilimitado".
export const FREE_LIMITE_ALUNOS = 3;
export const BASE_LIMITE_ALUNOS = 20;
export const PLUS_LIMITE_ALUNOS = 1_000_000;

export type PlanTier = "BASE" | "PLUS";
export type BillingInterval = "monthly" | "annual";

/**
 * Price ID do Stripe para um degrau + intervalo. 4 preços no total (2 degraus
 * pagos × mensal/anual) — evolução dos 2 preços únicos da Fase 20 (só
 * intervalo, um único degrau "PAGO"). Lançado tarde de propósito: cada
 * `requireEnv` só falha quando o preço específico é realmente necessário, não
 * no boot do servidor (mesmo padrão já usado por STRIPE_SECRET_KEY).
 */
export function stripePriceEnvVar(tier: PlanTier, interval: BillingInterval): string {
  return `STRIPE_PRICE_ID_${tier}_${interval === "annual" ? "ANNUAL" : "MONTHLY"}`;
}
