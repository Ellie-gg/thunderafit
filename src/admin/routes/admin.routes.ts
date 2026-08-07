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
  getExerciseTranslationsHandler,
  updateExerciseTranslationsHandler,
  updateUserRoleHandler,
  deleteUserHandler,
  listSelfTemplatesHandler,
  getSelfTemplateHandler,
  createSelfTemplateHandler,
  addSessionToSelfTemplateHandler,
  addExerciseToSelfSessionHandler,
  deleteSelfTemplateHandler,
  uploadSelfTemplateBannerHandler,
  updateSelfTemplateHandler,
  updateSelfTemplateTagsHandler,
  updateSelfSessionHandler,
  updateUserPremiumHandler,
  verifyUserEmailHandler,
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

  // Fase 121: traduções EN/ES do exercício pela UI de admin — antes só via
  // script de seed rodado à mão, o que fazia todo exercício cadastrado pela
  // tela nascer sem tradução até um dev rodar um script.
  fastify.get("/api/admin/exercises/:id/translations", auth, getExerciseTranslationsHandler);
  fastify.put("/api/admin/exercises/:id/translations", auth, updateExerciseTranslationsHandler);

  fastify.put("/api/admin/users/:id/role", auth, updateUserRoleHandler);
  // Fase 80: remoção definitiva de usuário (cascade manual, ver adminRepository.deleteUser).
  fastify.delete("/api/admin/users/:id", auth, deleteUserHandler);
  // Fase 58: concessão/revogação manual de Premium (ALUNO ou PERSONAL/NUTRI).
  // Fase 90: ganhou `tier`/`days` opcionais (grátis por N dias — "brinde").
  fastify.put("/api/admin/users/:id/premium", auth, updateUserPremiumHandler);
  // Fase 90: confirmar e-mail manualmente (bypass do fluxo real por link).
  fastify.put("/api/admin/users/:id/verify-email", auth, verifyUserEmailHandler);

  // Fase 34.5: curadoria de templates SELF ("Meu treino pessoal").
  fastify.get("/api/admin/self-templates", auth, listSelfTemplatesHandler);
  fastify.get("/api/admin/self-templates/:id", auth, getSelfTemplateHandler);
  fastify.post("/api/admin/self-templates", auth, createSelfTemplateHandler);
  // Fase 55.2: edição de nome (PT + tradução EN/ES) do template e das sessões.
  fastify.put("/api/admin/self-templates/:id", auth, updateSelfTemplateHandler);
  fastify.put("/api/admin/self-templates/:id/sessions/:sessionId", auth, updateSelfSessionHandler);
  // Fase 63: tags de filtro rápido (chips) — sempre substitui a lista inteira.
  fastify.put("/api/admin/self-templates/:id/tags", auth, updateSelfTemplateTagsHandler);
  fastify.post("/api/admin/self-templates/:id/sessions", auth, addSessionToSelfTemplateHandler);
  fastify.post(
    "/api/admin/self-templates/:id/sessions/:sessionId/exercises",
    auth,
    addExerciseToSelfSessionHandler
  );
  fastify.delete("/api/admin/self-templates/:id", auth, deleteSelfTemplateHandler);
  // Fase 52: banner do carrossel — mesmo motivo de bodyLimit maior da mídia
  // de exercício acima (base64 de imagem passa do default de 1MB).
  fastify.put(
    "/api/admin/self-templates/:id/banner",
    { preHandler: [(fastify as any).authenticate], bodyLimit: 8_000_000 },
    uploadSelfTemplateBannerHandler
  );
}
