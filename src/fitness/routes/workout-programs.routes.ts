import { FastifyInstance } from "fastify";
import {
  createProgramHandler,
  addSessionHandler,
  applyProgramHandler,
  listProgramsHandler,
  getProgramHandler,
} from "../controllers/workout-programs.controller";

export async function workoutProgramsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.post("/api/workout-programs", auth, createProgramHandler);
  fastify.get("/api/workout-programs", auth, listProgramsHandler);
  fastify.get("/api/workout-programs/:id", auth, getProgramHandler);
  fastify.post("/api/workout-programs/:id/sessions", auth, addSessionHandler);
  fastify.post("/api/workout-programs/:id/apply", auth, applyProgramHandler);
}
