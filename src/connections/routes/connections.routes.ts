import { FastifyInstance } from "fastify";
import {
  searchProfessionalsHandler,
  getMyProfileHandler,
  updateMyProfileHandler,
  createRequestHandler,
  listRequestsHandler,
  acceptRequestHandler,
  rejectRequestHandler,
} from "../controllers/connections.controller";

export async function connectionsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  // Perfil público do profissional (opt-in de disponibilidade + localização/bio).
  fastify.get("/api/professionals/me", auth, getMyProfileHandler);
  fastify.put("/api/professionals/me", auth, updateMyProfileHandler);
  fastify.get("/api/professionals/search", auth, searchProfessionalsHandler);

  // Solicitações de vínculo (aprovação manual).
  fastify.post("/api/connection-requests", auth, createRequestHandler);
  fastify.get("/api/connection-requests", auth, listRequestsHandler);
  fastify.post("/api/connection-requests/:id/accept", auth, acceptRequestHandler);
  fastify.post("/api/connection-requests/:id/reject", auth, rejectRequestHandler);
}
