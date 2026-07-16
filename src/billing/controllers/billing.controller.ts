import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Stub do webhook de billing (Fase 9) — antecipa o contrato para uma futura
 * integração com um agregador de pagamento (ex: RevenueCat), sem nenhuma
 * lógica de negócio real ainda. Só valida um envelope mínimo, loga o evento
 * recebido e responde 200. Não é protegido por `authenticate` — um webhook
 * externo não carrega o JWT da nossa aplicação; a validação de autenticidade
 * real (assinatura do provedor) fica para quando a integração for feita de
 * verdade.
 */
export async function billingWebhookHandler(
  request: FastifyRequest<{ Body: { event?: string; data?: unknown } }>,
  reply: FastifyReply
) {
  const { event, data } = request.body ?? {};

  if (!event || typeof event !== "string") {
    return reply.status(400).send({ error: "event é obrigatório e deve ser uma string." });
  }

  request.log.info({ event, data }, "Webhook de billing recebido (stub, sem lógica de negócio)");

  return reply.status(200).send({ received: true });
}
