import { FastifyInstance } from "fastify";
import { billingWebhookHandler } from "../controllers/billing.controller";

export async function billingRoutes(fastify: FastifyInstance) {
  fastify.post("/api/billing/webhook", billingWebhookHandler);
}
