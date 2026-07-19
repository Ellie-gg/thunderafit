import { FastifyInstance } from "fastify";
import {
  overviewHandler,
  listUsersHandler,
  listLoginsHandler,
  supportSlaHandler,
  accessLogsHandler,
  updateExerciseMediaHandler,
  listAdminExercisesHandler,
  createExerciseHandler,
  updateExerciseHandler,
  deleteExerciseHandler,
  updateUserRoleHandler,
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

  // Fase 33: CRUD do catálogo — rota separada da pública GET /api/exercises
  // (src/fitness/routes/exercises.routes.ts), que continua 100% leitura.
  fastify.get("/api/admin/exercises", auth, listAdminExercisesHandler);
  fastify.post("/api/admin/exercises", auth, createExerciseHandler);
  fastify.put("/api/admin/exercises/:id", auth, updateExerciseHandler);
  fastify.delete("/api/admin/exercises/:id", auth, deleteExerciseHandler);

  fastify.put("/api/admin/users/:id/role", auth, updateUserRoleHandler);
}
