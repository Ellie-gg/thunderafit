import { FastifyInstance } from "fastify";
import {
  billingWebhookHandler,
  checkoutSessionHandler,
  portalSessionHandler,
  billingStatusHandler,
} from "../controllers/billing.controller";

export async function billingRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  // Webhook: público (Stripe não carrega JWT) — autenticado pela assinatura.
  fastify.post("/api/billing/webhook", billingWebhookHandler);

  // Fluxo de assinatura: exige usuário autenticado.
  fastify.get("/api/billing/status", auth, billingStatusHandler);
  fastify.post("/api/billing/checkout-session", auth, checkoutSessionHandler);
  fastify.post("/api/billing/portal", auth, portalSessionHandler);
}
