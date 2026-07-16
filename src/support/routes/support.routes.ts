import { FastifyInstance } from "fastify";
import {
  listMyPersonalsHandler,
  createThreadHandler,
  listThreadsHandler,
  getThreadHandler,
  addMessageHandler,
} from "../controllers/support.controller";

export async function supportRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.get("/api/support/my-personals", auth, listMyPersonalsHandler);
  fastify.post("/api/support/threads", auth, createThreadHandler);
  fastify.get("/api/support/threads", auth, listThreadsHandler);
  fastify.get("/api/support/threads/:id", auth, getThreadHandler);
  fastify.post("/api/support/threads/:id/messages", auth, addMessageHandler);
}
