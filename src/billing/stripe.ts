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
// Fase 87: "annual" trocado por "quarterly" — o fundador decidiu não
// oferecer mais o compromisso anual pros planos do Personal, só
// mensal/trimestral (mesmo intervalo já usado pelo Aluno Premium).
export type BillingInterval = "monthly" | "quarterly";

/**
 * Price ID do Stripe para um degrau + intervalo. 4 preços no total (2 degraus
 * pagos × mensal/trimestral) — evolução dos 2 preços únicos da Fase 20 (só
 * intervalo, um único degrau "PAGO"). Lançado tarde de propósito: cada
 * `requireEnv` só falha quando o preço específico é realmente necessário, não
 * no boot do servidor (mesmo padrão já usado por STRIPE_SECRET_KEY).
 */
export function stripePriceEnvVar(tier: PlanTier, interval: BillingInterval): string {
  return `STRIPE_PRICE_ID_${tier}_${interval === "quarterly" ? "QUARTERLY" : "MONTHLY"}`;
}

/**
 * Mapa reverso price ID -> degrau, usado quando o Stripe manda um evento que
 * só traz o price atual da subscription (`customer.subscription.updated`,
 * disparado inclusive quando o cliente TROCA de degrau pelo Portal do
 * Cliente, fora do nosso fluxo de checkout) — não dá pra confiar em metadata
 * setado na criação nesse caso, porque o Portal não reescreve ela ao trocar
 * de price. Ignora silenciosamente um degrau cujas env vars não estão
 * configuradas neste ambiente (ex: só BASE está ativo ainda).
 *
 * Vive aqui (não em `billing.service.ts`) pra `src/lib/plan-expiry.ts`
 * conseguir reaproveitar sem criar import circular (`plan-expiry` já é
 * importado POR `billing.service.ts`).
 */
export function tierForPriceId(priceId: string): PlanTier {
  const tiers: PlanTier[] = ["BASE", "PLUS"];
  const intervals: BillingInterval[] = ["monthly", "quarterly"];
  for (const tier of tiers) {
    for (const interval of intervals) {
      const envVar = stripePriceEnvVar(tier, interval);
      if (process.env[envVar] === priceId) return tier;
    }
  }
  // Price desconhecido (env não configurada, ou price fora do catálogo atual
  // — ex: um price legado de um assinante grandfathered depois de um reajuste
  // de preço) — concede o degrau pago mais conservador em vez de falhar a
  // assinatura ativa inteira; nunca PLUS por adivinhação. Achado real
  // (auditoria 2026-07-31): isso rebaixa PLUS legados pra BASE em silêncio
  // sempre que o price não é reconhecido — logado aqui pra parar de ser
  // silencioso; a causa real (price legado sem entrada correspondente nas
  // env vars) precisa de decisão manual, não dá pra resolver sozinho aqui.
  console.warn(
    `[billing] Price desconhecido "${priceId}" não corresponde a nenhuma env var configurada — concedendo BASE como fallback conservador. Se este price já foi válido (assinante legado), adicione a env var correspondente.`
  );
  return "BASE";
}

// Fase 56 (Aluno Premium — guardrails), preços atualizados na Fase 87
// (fundador definiu direto, sem checkout Stripe real ainda — "vamos refinar
// isso quando colocarmos o pagamento em produção"; só constantes
// documentadas, sem nenhum STRIPE_PRICE_ID_ALUNO_PREMIUM_* real ainda).
// `Math.round` porque centavos são inteiros — nunca fração de centavo.
export const ALUNO_PREMIUM_TRIAL_DAYS = 7;
export const ALUNO_PREMIUM_MONTHLY_PRICE_CENTS = 999;
export const ALUNO_PREMIUM_QUARTERLY_MONTHS = 3;
// Fase 87: unificado com o desconto trimestral dos planos do Personal
// (antes era 30%, só pro Aluno Premium).
export const ALUNO_PREMIUM_QUARTERLY_DISCOUNT_PCT = 20;
export const ALUNO_PREMIUM_QUARTERLY_PRICE_CENTS = Math.round(
  ALUNO_PREMIUM_MONTHLY_PRICE_CENTS *
    ALUNO_PREMIUM_QUARTERLY_MONTHS *
    (1 - ALUNO_PREMIUM_QUARTERLY_DISCOUNT_PCT / 100)
);
