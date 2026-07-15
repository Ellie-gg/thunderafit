import { FastifyInstance } from "fastify";
import { listExercisesHandler } from "../controllers/exercises.controller";

export async function exercisesRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/exercises",
    {
      preHandler: [(fastify as any).authenticate],
    },
    listExercisesHandler
  );
}
