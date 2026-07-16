import { FastifyInstance } from "fastify";
import {
  listNotificationsHandler,
  unreadCountHandler,
  markReadHandler,
  markAllReadHandler,
} from "../controllers/notifications.controller";

export async function notificationsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.get("/api/notifications", auth, listNotificationsHandler);
  fastify.get("/api/notifications/unread-count", auth, unreadCountHandler);
  fastify.post("/api/notifications/:id/read", auth, markReadHandler);
  fastify.post("/api/notifications/read-all", auth, markAllReadHandler);
}
