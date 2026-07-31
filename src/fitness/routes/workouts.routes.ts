import { FastifyInstance } from "fastify";
import {
  listWorkoutsHandler,
  createWorkoutHandler,
  generateWorkoutHandler,
  addExerciseHandler,
  moveExerciseHandler,
  deleteExerciseHandler,
  renameWorkoutHandler,
  getWorkoutHandler,
  completeWorkoutHandler,
} from "../controllers/workouts.controller";
import { workoutDetailSchema } from "./workout-response-schemas";

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

  fastify.delete(
    "/api/workouts/:id/exercises/:exerciseId",
    {
      preHandler: [(fastify as any).authenticate],
    },
    deleteExerciseHandler
  );

  // Renomear a sessão ("treino do dia") — achado reportado pelo fundador:
  // nome só era definido na criação, sem jeito de editar depois.
  fastify.patch(
    "/api/workouts/:id/name",
    {
      preHandler: [(fastify as any).authenticate],
    },
    renameWorkoutHandler
  );

  fastify.get(
    "/api/workouts/:id",
    {
      preHandler: [(fastify as any).authenticate],
      // Perf (Grupo Y, item 99): tela de execução de treino, a mais aberta
      // pelo aluno — ver workout-response-schemas.ts pro mapeamento
      // campo-a-campo que justifica cada propriedade aqui.
      schema: {
        response: {
          200: {
            type: "object",
            properties: { workout: workoutDetailSchema },
          },
        },
      },
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
