import { FastifyInstance } from "fastify";
import {
  createProgramHandler,
  addSessionHandler,
  applyProgramHandler,
  listProgramsHandler,
  getProgramHandler,
  deleteProgramHandler,
  listSelfTemplatesHandler,
  applySelfTemplateHandler,
} from "../controllers/workout-programs.controller";

export async function workoutProgramsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.post("/api/workout-programs", auth, createProgramHandler);
  fastify.get("/api/workout-programs", auth, listProgramsHandler);
  // Fase 34.5 — precisa vir ANTES de "/:id" (senão "self-templates" seria
  // interpretado como um :id literal pela rota GET /api/workout-programs/:id).
  fastify.get("/api/workout-programs/self-templates", auth, listSelfTemplatesHandler);
  fastify.get("/api/workout-programs/:id", auth, getProgramHandler);
  fastify.post("/api/workout-programs/:id/sessions", auth, addSessionHandler);
  fastify.post("/api/workout-programs/:id/apply", auth, applyProgramHandler);
  fastify.post("/api/workout-programs/:id/apply-self-template", auth, applySelfTemplateHandler);
  fastify.delete("/api/workout-programs/:id", auth, deleteProgramHandler);
}
