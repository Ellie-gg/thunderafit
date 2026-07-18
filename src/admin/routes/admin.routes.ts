import { FastifyInstance } from "fastify";
import {
  overviewHandler,
  listUsersHandler,
  listLoginsHandler,
  supportSlaHandler,
  accessLogsHandler,
  updateExerciseMediaHandler,
} from "../controllers/admin.controller";

export async function adminRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.get("/api/admin/overview", auth, overviewHandler);
  fastify.get("/api/admin/users", auth, listUsersHandler);
  fastify.get("/api/admin/logins", auth, listLoginsHandler);
  fastify.get("/api/admin/support-sla", auth, supportSlaHandler);
  fastify.get("/api/admin/access-logs", auth, accessLogsHandler);

  // Fase 32: bodyLimit maior só nesta rota (base64 de vídeo/GIF é maior que
  // o default de 1MB do Fastify) — não muda o limite global, que continua
  // protegendo todas as outras rotas.
  fastify.put(
    "/api/admin/exercises/:id/media",
    { preHandler: [(fastify as any).authenticate], bodyLimit: 8_000_000 },
    updateExerciseMediaHandler
  );
}
