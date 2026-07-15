import { FastifyInstance } from "fastify";
import {
  listWorkoutsHandler,
  createWorkoutHandler,
  addExerciseHandler,
  getWorkoutHandler,
} from "../controllers/workouts.controller";

export async function workoutsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/workouts",
    {
      preHandler: [(fastify as any).authenticate],
    },
    listWorkoutsHandler
  );

  fastify.post(
    "/api/workouts",
    {
      preHandler: [(fastify as any).authenticate],
    },
    createWorkoutHandler
  );

  fastify.post(
    "/api/workouts/:id/exercises",
    {
      preHandler: [(fastify as any).authenticate],
    },
    addExerciseHandler
  );

  fastify.get(
    "/api/workouts/:id",
    {
      preHandler: [(fastify as any).authenticate],
    },
    getWorkoutHandler
  );
}
