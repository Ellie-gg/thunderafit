import { FastifyInstance } from "fastify";
import {
  createProgramHandler,
  addSessionHandler,
  applyProgramHandler,
  listProgramsHandler,
  getProgramHandler,
  deleteProgramHandler,
  renameProgramHandler,
  listSelfTemplatesHandler,
  applySelfTemplateHandler,
  saveInstanceAsTemplateHandler,
  listPersonalCatalogHandler,
  applyCatalogTemplateHandler,
  createSelfProgramHandler,
  addSelfSessionHandler,
} from "../controllers/workout-programs.controller";
import { workoutProgramDetailSchema } from "./workout-response-schemas";

export async function workoutProgramsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.post("/api/workout-programs", auth, createProgramHandler);
  fastify.get("/api/workout-programs", auth, listProgramsHandler);
  // Fase 34.5 — precisa vir ANTES de "/:id" (senão "self-templates" seria
  // interpretado como um :id literal pela rota GET /api/workout-programs/:id).
  fastify.get("/api/workout-programs/self-templates", auth, listSelfTemplatesHandler);
  // Fase 62 — mesmo motivo acima: "personal-catalog" precisa vir ANTES de "/:id".
  fastify.get("/api/workout-programs/personal-catalog", auth, listPersonalCatalogHandler);
  fastify.post(
    "/api/workout-programs/personal-catalog/:id/apply",
    auth,
    applyCatalogTemplateHandler
  );
  // Fase 85 — mesmo motivo acima: "self" precisa vir ANTES de "/:id".
  fastify.post("/api/workout-programs/self", auth, createSelfProgramHandler);
  fastify.get(
    "/api/workout-programs/:id",
    {
      ...auth,
      // Perf (Grupo Y, item 99): ver workout-response-schemas.ts pro
      // mapeamento campo-a-campo que justifica cada propriedade aqui.
      schema: {
        response: {
          200: {
            type: "object",
            properties: { program: workoutProgramDetailSchema },
          },
        },
      },
    },
    getProgramHandler
  );
  fastify.post("/api/workout-programs/:id/sessions", auth, addSessionHandler);
  fastify.post("/api/workout-programs/:id/self-sessions", auth, addSelfSessionHandler);
  fastify.post("/api/workout-programs/:id/apply", auth, applyProgramHandler);
  fastify.post("/api/workout-programs/:id/apply-self-template", auth, applySelfTemplateHandler);
  fastify.post("/api/workout-programs/:id/save-as-template", auth, saveInstanceAsTemplateHandler);
  fastify.delete("/api/workout-programs/:id", auth, deleteProgramHandler);
  // Renomear o programa — achado reportado pelo fundador: nome só era
  // definido na criação, sem jeito de editar depois.
  fastify.patch("/api/workout-programs/:id/name", auth, renameProgramHandler);
}
