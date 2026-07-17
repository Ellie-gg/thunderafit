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

// Planos (Fase 20): limite Freemium 3, plano pago 50 alunos.
export const FREE_LIMITE_ALUNOS = 3;
export const PAGO_LIMITE_ALUNOS = 50;
