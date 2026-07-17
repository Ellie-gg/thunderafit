import { FastifyRequest, FastifyReply } from "fastify";
import type Stripe from "stripe";
import { getStripe } from "../stripe";
import { billingService } from "../services/billing.service";

function handleError(err: any, reply: FastifyReply) {
  const status = err?.statusCode ?? 500;
  return reply.status(status).send({ error: err?.message ?? "Erro interno." });
}

/**
 * Webhook do Stripe (Fase 20) — PÚBLICO por natureza (o Stripe não carrega
 * nosso JWT), mas autenticado pela ASSINATURA. `constructEvent` valida o
 * header `Stripe-Signature` contra os bytes crus do corpo (request.rawBody,
 * capturado pelo content-type parser em app.ts) usando STRIPE_WEBHOOK_SECRET.
 * Requisição sem assinatura válida é rejeitada com 400 ANTES de qualquer
 * lógica de negócio — corrige o gap da Fase 17 (antes era público sem
 * verificação nenhuma).
 */
export async function billingWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return reply.status(500).send({ error: "STRIPE_WEBHOOK_SECRET não configurada." });
  }

  const signature = request.headers["stripe-signature"];
  if (!signature) {
    return reply.status(400).send({ error: "Assinatura do webhook ausente." });
  }

  const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    return reply.status(400).send({ error: "Corpo do webhook indisponível para verificação." });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature as string, secret);
  } catch (err) {
    // Assinatura inválida/adulterada/segredo errado — rejeita, não processa.
    request.log.warn({ err: (err as Error).message }, "Webhook Stripe com assinatura inválida");
    return reply.status(400).send({ error: "Assinatura do webhook inválida." });
  }

  try {
    await billingService.handleWebhookEvent(event);
    return reply.status(200).send({ received: true });
  } catch (err) {
    // Erro ao processar um evento JÁ verificado — 500 para o Stripe re-tentar.
    request.log.error({ err: (err as Error).message, type: event.type }, "Falha ao processar webhook");
    return reply.status(500).send({ error: "Falha ao processar o evento." });
  }
}

export async function checkoutSessionHandler(
  request: FastifyRequest<{ Body: { interval?: "monthly" | "annual" } }>,
  reply: FastifyReply
) {
  const { sub, role } = (request as any).user;
  // Backend suporta profissionais (Fase 20). A UI só expõe para PERSONAL
  // (Nutricionista está fora da interface desde a Fase 18) — o gate aqui
  // barra ALUNO/ADMIN.
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas profissionais podem assinar um plano." });
  }
  const interval = request.body?.interval === "annual" ? "annual" : "monthly";
  try {
    const url = await billingService.createCheckoutSession(sub, interval);
    return reply.status(200).send({ url });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function billingStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { sub } = (request as any).user;
  try {
    const status = await billingService.getStatus(sub);
    return reply.status(200).send(status);
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function portalSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { sub, role } = (request as any).user;
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas profissionais têm assinatura para gerenciar." });
  }
  try {
    const url = await billingService.createPortalSession(sub);
    return reply.status(200).send({ url });
  } catch (err) {
    return handleError(err, reply);
  }
}
