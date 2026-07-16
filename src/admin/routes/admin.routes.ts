import { FastifyInstance } from "fastify";
import {
  overviewHandler,
  listUsersHandler,
  listLoginsHandler,
  supportSlaHandler,
  accessLogsHandler,
} from "../controllers/admin.controller";

export async function adminRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.get("/api/admin/overview", auth, overviewHandler);
  fastify.get("/api/admin/users", auth, listUsersHandler);
  fastify.get("/api/admin/logins", auth, listLoginsHandler);
  fastify.get("/api/admin/support-sla", auth, supportSlaHandler);
  fastify.get("/api/admin/access-logs", auth, accessLogsHandler);
}
