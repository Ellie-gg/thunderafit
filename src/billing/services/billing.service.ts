import type Stripe from "stripe";
import { getStripe, tierForPriceId, stripePriceEnvVar, PlanTier, BillingInterval } from "../stripe";
import { billingRepository } from "../repository/billing.repository";
import { revertExpiredPersonalPlan, getPersonalAccessStatus } from "../../lib/plan-expiry";
import { notificationsService } from "../../notifications/services/notifications.service";

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
    // B10 (auditoria 2026-07-31): sem isso, quem já tem uma subscription
    // ativa podia criar uma SEGUNDA no mesmo customer (ex: página de upgrade
    // aberta durante uma instabilidade, `statusQuery` erra, a UI falha
    // aberta e mostra os botões de assinar de novo) — cobrança duplicada, e
    // cancelar a assinatura errada pelo Portal não corrige nada porque o
    // guard de reordenação do webhook ignora eventos de uma subscription que
    // não é mais a corrente. Troca de degrau é só pelo Portal do Cliente.
    if (user.stripeSubscriptionId) {
      throw httpError(
        "Você já tem uma assinatura ativa. Gerencie ou troque de plano pelo Portal do Cliente.",
        400
      );
    }

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
    let user = await billingRepository.findUserById(userId);
    if (!user) throw httpError("Usuário não encontrado.", 404);
    // Fase 90: concessão manual de plano com prazo (admin) — reverte pra
    // FREE sozinha se já venceu, antes de montar o status exibido na UI.
    user = await revertExpiredPersonalPlan(user);
    // Fase 103: status de excesso de alunos/carência pro banner do Personal
    // — inofensivo pra ALUNO (nunca é "personalId" de nenhum ClientRelation,
    // então sempre volta overLimit: false).
    const accessStatus = await getPersonalAccessStatus(userId);
    return {
      planoAssinatura: user.planoAssinatura,
      limiteAlunos: user.limiteAlunos,
      hasSubscription: !!user.stripeSubscriptionId,
      // Fase 93: exposto pro frontend mostrar "quando termina" numa
      // concessão manual do admin (Fase 90) — sempre null pra assinatura
      // Stripe real (applyPaidPlan/applyFreePlan sempre limpam este campo).
      planoAssinaturaExpiresAt: user.planoAssinaturaExpiresAt,
      // Fase 103: ver src/lib/plan-expiry.ts#getPersonalAccessStatus.
      overLimiteAlunos: accessStatus.overLimit,
      overLimiteAlunosBlocked: accessStatus.blocked,
      overLimiteAlunosGraceDaysLeft: accessStatus.graceDaysLeft,
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
   *    plano indevidamente. Como o cancelamento (`deleted`) zera
   *    `stripeSubscriptionId`, o evento obsoleto não casa e é ignorado — mas
   *    um downgrade NÃO-terminal (`updated` com status `past_due`/`unpaid`/
   *    etc.) mantém o id (`applyInactivePlan`), porque a subscription ainda
   *    existe e pode voltar a ficar ativa (ver achado abaixo).
   *  - Idempotente: reaplicar PAGO/FREE do mesmo estado não causa dano.
   *
   * **Achados corrigidos nesta revisão (auditoria 2026-07-31):**
   *  - B1: `updated(past_due)` zerava `stripeSubscriptionId` (mesmo tratamento
   *    de `deleted`) — quando o cliente corrigia o pagamento, o
   *    `updated(active)` de RECUPERAÇÃO da MESMA subscription era rejeitado
   *    pelo guard de reordenação acima (id já nulo), e o plano nunca voltava
   *    enquanto o Stripe seguia cobrando. Corrigido usando `applyInactivePlan`
   *    (mantém o id) para status não-ativo vindo de `updated`; só `deleted`
   *    (a subscription realmente não existe mais) zera o id.
   *  - B2: `checkout.session.completed`/`async_payment_succeeded` confiavam
   *    cegamente em `session.metadata.tier` (congelado na criação da sessão)
   *    e aplicavam o plano incondicionalmente — uma reentrega tardia (depois
   *    do Stripe re-tentar um 500 nosso) podia conceder um plano já cancelado
   *    ou rebaixar quem já tinha feito upgrade. Corrigido buscando o estado
   *    AO VIVO da subscription no Stripe antes de aplicar: só concede se ela
   *    ainda está ativa, e deriva o degrau do price ATUAL (não da metadata
   *    congelada) — mesma fonte de verdade já usada em `updated` acima.
   *  - B12: `invoice.payment_failed` notificava sem checar se a fatura é da
   *    subscription CORRENTE do usuário — no caso de 2 subscriptions no mesmo
   *    customer (ver B10), a falha de uma subscription órfã gerava um aviso
   *    sobre a assinatura ATIVA, que está em dia.
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
        if (!pago) {
          // Pagamento pendente (ex: boleto/Pix): guarda os ids para casar os
          // eventos futuros, mas NÃO concede o plano ainda.
          if (customerId) await billingRepository.linkStripe(userId, customerId, subscriptionId);
          return;
        }

        if (customerId) await billingRepository.setStripeCustomerId(userId, customerId);

        // B2: confirma o estado AO VIVO da subscription em vez de confiar
        // cegamente na sessão (que pode ser uma reentrega tardia de um evento
        // já superado por um cancelamento ou upgrade posterior).
        if (subscriptionId) {
          const stripe = getStripe();
          const liveSub = await stripe.subscriptions.retrieve(subscriptionId);
          const aindaAtiva = liveSub.status === "active" || liveSub.status === "trialing";
          if (!aindaAtiva) {
            // Reentrega tardia de um checkout cuja subscription já foi
            // cancelada/expirou nesse meio-tempo — não concede nada.
            return;
          }
          const priceId = liveSub.items?.data?.[0]?.price?.id;
          const tier = priceId ? tierForPriceId(priceId) : "BASE";
          await billingRepository.applyPaidPlan(userId, tier, subscriptionId);
        } else {
          // Sem subscription (não deveria acontecer em `mode: "subscription"`,
          // mas não há o que verificar ao vivo) — usa a metadata como antes.
          const tier = session.metadata?.tier === "PLUS" ? "PLUS" : "BASE";
          await billingRepository.applyPaidPlan(userId, tier, subscriptionId);
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
          // B1: status não-ativo mas NÃO terminal (past_due, unpaid,
          // incomplete...) — a subscription ainda existe no Stripe e pode se
          // recuperar. Mantém o id (`applyInactivePlan`) pra o evento de
          // recuperação da MESMA subscription não ser rejeitado pelo guard
          // acima. Só `deleted` (abaixo) zera o id de verdade.
          await billingRepository.applyInactivePlan(user.id, sub.id);
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

      case "invoice.payment_failed": {
        // Fase 103 — achado da pesquisa de billing: antes este evento caía
        // no default (nenhuma ação). NÃO muda o plano aqui (isso já
        // acontece via customer.subscription.updated assim que o Stripe
        // marca a assinatura como `past_due`, o que tipicamente já ocorre na
        // PRIMEIRA falha, não só depois de esgotar as tentativas de
        // cobrança) — só avisa o Personal proativamente, o mais cedo
        // possível, pra ele poder agir antes que o downgrade de verdade
        // aconteça (mensagem clara + 1 ação, sem esperar o Personal
        // descobrir sozinho quando algo já parou de funcionar).
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) return;
        const user = await billingRepository.findUserByStripeCustomerId(customerId);
        if (!user) return;
        // B12: só notifica se a fatura é da subscription CORRENTE do usuário
        // — evita avisar sobre uma subscription órfã (ver B10) enquanto a
        // assinatura ativa de verdade está em dia. Nesta versão da API do
        // Stripe, a subscription de origem vive em `invoice.parent.
        // subscription_details.subscription` (não mais em `invoice.subscription`).
        const invoiceSubscription = invoice.parent?.subscription_details?.subscription;
        const invoiceSubscriptionId =
          typeof invoiceSubscription === "string" ? invoiceSubscription : invoiceSubscription?.id;
        if (invoiceSubscriptionId && invoiceSubscriptionId !== user.stripeSubscriptionId) return;
        await notificationsService.notify(
          user.id,
          "payment_failed",
          "Não conseguimos processar o pagamento da sua assinatura. Atualize seu método de pagamento para continuar com o plano atual."
        );
        return;
      }

      default:
        // Evento não tratado — reconhecido (200) mas sem ação.
        return;
    }
  },
};
