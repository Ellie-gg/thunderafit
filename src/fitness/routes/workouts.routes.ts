import { FastifyInstance } from "fastify";
import {
  listWorkoutsHandler,
  createWorkoutHandler,
  generateWorkoutHandler,
  addExerciseHandler,
  moveExerciseHandler,
  getWorkoutHandler,
  completeWorkoutHandler,
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

  // "Montagem Inteligente": sem :id nenhum, não persiste nada — registrado
  // antes das rotas /:id/... só por hábito defensivo, embora não haja risco
  // real de colisão aqui (nenhuma rota bare POST /api/workouts/:id existe).
  fastify.post(
    "/api/workouts/generate",
    {
      preHandler: [(fastify as any).authenticate],
    },
    generateWorkoutHandler
  );

  fastify.post(
    "/api/workouts/:id/exercises",
    {
      preHandler: [(fastify as any).authenticate],
    },
    addExerciseHandler
  );

  fastify.post(
    "/api/workouts/:id/exercises/:exerciseId/move",
    {
      preHandler: [(fastify as any).authenticate],
    },
    moveExerciseHandler
  );

  fastify.get(
    "/api/workouts/:id",
    {
      preHandler: [(fastify as any).authenticate],
    },
    getWorkoutHandler
  );

  fastify.post(
    "/api/workouts/:id/complete",
    {
      preHandler: [(fastify as any).authenticate],
    },
    completeWorkoutHandler
  );
}
