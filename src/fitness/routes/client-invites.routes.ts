import { FastifyInstance } from "fastify";
import {
  createInviteHandler,
  listInvitesHandler,
  revokeInviteHandler,
  previewInviteHandler,
  consumeInviteHandler,
} from "../controllers/client-invites.controller";

export async function clientInvitesRoutes(fastify: FastifyInstance) {
  // POST /api/client-invites — Personal/Nutricionista cria um convite
  fastify.post(
    "/api/client-invites",
    { preHandler: [(fastify as any).authenticate] },
    createInviteHandler
  );

  // GET /api/client-invites — lista os convites pendentes do profissional autenticado
  fastify.get(
    "/api/client-invites",
    { preHandler: [(fastify as any).authenticate] },
    listInvitesHandler
  );

  // DELETE /api/client-invites/:id — revoga um convite ainda não consumido
  fastify.delete(
    "/api/client-invites/:id",
    { preHandler: [(fastify as any).authenticate] },
    revokeInviteHandler
  );

  // GET /api/client-invites/preview?token=... — PÚBLICA, sem autenticação
  // (a tela de login/cadastro chama isso ANTES de existir sessão).
  fastify.get("/api/client-invites/preview", previewInviteHandler);

  // POST /api/client-invites/consume — autenticada; consome o convite pra
  // quem já está logado (sem precisar logar de novo). Ver comentário em
  // client-invites.controller.ts#consumeInviteHandler.
  fastify.post(
    "/api/client-invites/consume",
    { preHandler: [(fastify as any).authenticate] },
    consumeInviteHandler
  );
}
