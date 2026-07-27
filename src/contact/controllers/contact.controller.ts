import { FastifyRequest, FastifyReply } from "fastify";
import { contactService } from "../services/contact.service";

export async function sendContactMessageHandler(
  request: FastifyRequest<{ Body: { title?: string; message?: string } }>,
  reply: FastifyReply
) {
  const { sub, role } = (request as any).user;
  try {
    const result = await contactService.send(sub, role, request.body?.title ?? "", request.body?.message ?? "");
    return reply.status(201).send(result);
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  }
}
