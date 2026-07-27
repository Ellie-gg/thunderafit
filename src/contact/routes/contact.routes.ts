import { FastifyInstance } from "fastify";
import { sendContactMessageHandler } from "../controllers/contact.controller";

export async function contactRoutes(fastify: FastifyInstance) {
  // Fase 78 — "Fale Conosco": qualquer papel autenticado (Aluno, Personal,
  // Nutricionista) pode mandar uma mensagem.
  fastify.post(
    "/api/contact",
    { preHandler: [(fastify as any).authenticate] },
    sendContactMessageHandler
  );
}
