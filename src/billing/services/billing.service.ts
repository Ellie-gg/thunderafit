import type Stripe from "stripe";
import { getStripe, stripePriceEnvVar, PlanTier, BillingInterval } from "../stripe";
import { billingRepository } from "../repository/billing.repository";

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw httpError(`Config de billing ausente: ${key}.`, 500);
  return v;
}

function frontendOrigin(): string {
  return process.env.ALLOWED_ORIGIN ?? "http://localhost:3001";
}

type Interval = BillingInterval;

function priceIdFor(tier: PlanTier, interval: Interval): string {
  return requireEnv(stripePriceEnvVar(tier, interval));
}

/**
 * Mapa reverso price ID -> degrau, usado quando o Stripe manda um evento que
 * só traz o price atual da subscription (`customer.subscription.updated`,
 * disparado inclusive quando o cliente TROCA de degrau pelo Portal do
 * Cliente, fora do nosso fluxo de checkout) — não dá pra confiar em metadata
 * setado na criação nesse caso, porque o Portal não reescreve ela ao trocar
 * de price. Ignora silenciosamente um degrau cujas env vars não estão
 * configuradas neste ambiente (ex: só BASE está ativo ainda).
 */
function tierForPriceId(priceId: string): PlanTier {
  const tiers: PlanTier[] = ["BASE", "PLUS"];
  const intervals: Interval[] = ["monthly", "annual"];
  for (const tier of tiers) {
    for (const interval of intervals) {
      const envVar = stripePriceEnvVar(tier, interval);
      if (process.env[envVar] === priceId) return tier;
    }
  }
  // Price desconhecido (env não configurada ou price fora do catálogo atual)
  // — concede o degrau pago mais conservador em vez de falhar a assinatura
  // ativa inteira; nunca PLUS por adivinhação.
  return "BASE";
}

export const billingService = {
  /**
   * Cria uma Stripe Checkout Session (hospedada) para o profissional
   * autenticado assinar um degrau pago (BASE ou PLUS). Reaproveita o Stripe
   * Customer se já existir (evita cliente duplicado a cada tentativa). Nunca
   * toca em dado de cartão — isso é 100% do Checkout do Stripe.
   */
  async createCheckoutSession(userId: string, tier: PlanTier, interval: Interval): Promise<string> {
    const user = await billingRepository.findUserById(userId);
    if (!user) throw httpError("Usuário não encontrado.", 404);

    const priceId = priceIdFor(tier, interval);
    const stripe = getStripe();

    // Reusa o customer se já houver; senão cria um com metadata do usuário.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await billingRepository.setStripeCustomerId(user.id, customerId);
    }

    const origin = frontendOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      // client_reference_id é o elo à prova de falha para mapear o
      // checkout.session.completed de volta ao usuário do ThunderaFit;
      // metadata.tier é como o mesmo evento sabe qual DEGRAU foi comprado
      // (o line_item por si só exigiria uma chamada extra à API pra expandir
      // o price — metadata evita essa ida a mais, e o webhook lê session
      // inteira, então já está ali de graça).
      client_reference_id: user.id,
      metadata: { tier },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/personal/upgrade?status=success`,
      cancel_url: `${origin}/personal/upgrade?status=cancel`,
    });

    if (!session.url) throw httpError("Stripe não retornou a URL de checkout.", 502);
    return session.url;
  },

  /** Estado de assinatura do usuário para a UI (plano, limite, tem assinatura). */
  async getStatus(userId: string) {
    const user = await billingRepository.findUserById(userId);
    if (!user) throw httpError("Usuário não encontrado.", 404);
    return {
      planoAssinatura: user.planoAssinatura,
      limiteAlunos: user.limiteAlunos,
      hasSubscription: !!user.stripeSubscriptionId,
    };
  },

  /**
   * Cria uma sessão do Portal do Cliente do Stripe (gestão de assinatura +
   * método de pagamento + cancelamento, tudo pronto). Só para quem já tem
   * customer no Stripe.
   */
  async createPortalSession(userId: string): Promise<string> {
    const user = await billingRepository.findUserById(userId);
    if (!user) throw httpError("Usuário não encontrado.", 404);
    if (!user.stripeCustomerId) {
      throw httpError("Nenhuma assinatura ativa para gerenciar.", 400);
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendOrigin()}/personal/upgrade`,
    });
    return session.url;
  },

  /**
   * Processa um evento de webhook JÁ VERIFICADO (assinatura conferida no
   * controller). Atualiza plano/limite do usuário.
   *
   * Endurecimentos (revisão de segurança da Fase 20):
   *  - `checkout.session.completed` só concede PAGO se o pagamento já
   *    CONFIRMOU (`payment_status` paid/no_payment_required). Para métodos de
   *    confirmação atrasada (boleto/Pix — comuns no público BR) o evento
   *    dispara com `unpaid`: só guardamos os ids e aguardamos o
   *    `async_payment_succeeded`/`subscription.updated`. Evita PAGO antes de
   *    o dinheiro entrar.
   *  - Eventos de subscription (updated/deleted) só agem quando `sub.id` é a
   *    subscription CORRENTE do usuário (`user.stripeSubscriptionId`). O
   *    Stripe não garante ordem nem unicidade de entrega; sem essa guarda, um
   *    `updated(active)` obsoleto reentregue APÓS um cancelamento reativaria o
   *    plano indevidamente. Como o downgrade zera `stripeSubscriptionId`, o
   *    evento obsoleto não casa e é ignorado.
   *  - Idempotente: reaplicar PAGO/FREE do mesmo estado não causa dano.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        if (!userId) return; // sessão sem referência ao usuário — ignora com segurança

        const pago =
          session.payment_status === "paid" || session.payment_status === "no_payment_required";
        if (pago) {
          const tier = session.metadata?.tier === "PLUS" ? "PLUS" : "BASE";
          if (customerId) await billingRepository.setStripeCustomerId(userId, customerId);
          await billingRepository.applyPaidPlan(userId, tier, subscriptionId);
        } else {
          // Pagamento pendente (ex: boleto/Pix): guarda os ids para casar os
          // eventos futuros, mas NÃO concede o plano ainda.
          if (customerId) await billingRepository.linkStripe(userId, customerId, subscriptionId);
        }
        return;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await billingRepository.findUserByStripeCustomerId(customerId);
        if (!user) return;
        // Só age sobre a subscription CORRENTE do usuário (igualdade estrita).
        // Nulo nunca casa: um `updated(active)` obsoleto reentregue após um
        // cancelamento (que zerou stripeSubscriptionId) é ignorado, em vez de
        // reativar o plano. A primeira ativação sempre chega via
        // checkout.session.completed, que fixa o subscriptionId corrente.
        if (user.stripeSubscriptionId !== sub.id) return;
        const ativo = sub.status === "active" || sub.status === "trialing";
        if (ativo) {
          // Lê o price ATUAL da subscription (não metadata da criação): é o
          // único jeito confiável de saber o degrau quando o cliente troca de
          // plano pelo Portal do Cliente do Stripe, sem passar pelo nosso
          // checkout de novo.
          const priceId = sub.items?.data?.[0]?.price?.id;
          const tier = priceId ? tierForPriceId(priceId) : "BASE";
          await billingRepository.applyPaidPlan(user.id, tier, sub.id);
        } else {
          await billingRepository.applyFreePlan(user.id);
        }
        return;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await billingRepository.findUserByStripeCustomerId(customerId);
        if (!user) return;
        // Ignora se não for a subscription corrente (reentrega/subscription antiga).
        if (user.stripeSubscriptionId !== sub.id) return;
        await billingRepository.applyFreePlan(user.id);
        return;
      }

      default:
        // Evento não tratado — reconhecido (200) mas sem ação.
        return;
    }
  },
};
