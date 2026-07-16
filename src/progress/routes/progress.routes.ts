import { FastifyInstance } from "fastify";
import {
  loadHistoryHandler,
  frequencyHandler,
  listLoggedExercisesHandler,
} from "../controllers/progress.controller";

export async function progressRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/progress/load-history",
    { preHandler: [(fastify as any).authenticate] },
    loadHistoryHandler
  );

  fastify.get(
    "/api/progress/frequency",
    { preHandler: [(fastify as any).authenticate] },
    frequencyHandler
  );

  fastify.get(
    "/api/progress/exercises",
    { preHandler: [(fastify as any).authenticate] },
    listLoggedExercisesHandler
  );
}
