import { FastifyInstance } from "fastify";
import { createSetLogHandler, listSetLogsHandler } from "../controllers/setlogs.controller";

export async function setlogsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/workouts/:workoutId/exercises/:workoutExerciseId/logs",
    {
      preHandler: [(fastify as any).authenticate],
    },
    createSetLogHandler
  );

  fastify.get(
    "/api/workouts/:workoutId/exercises/:workoutExerciseId/logs",
    {
      preHandler: [(fastify as any).authenticate],
    },
    listSetLogsHandler
  );
}
