import { FastifyInstance } from "fastify";
import {
  listWorkoutsHandler,
  createWorkoutHandler,
  generateWorkoutHandler,
  addExerciseHandler,
  moveExerciseHandler,
  deleteExerciseHandler,
  renameWorkoutHandler,
  deleteWorkoutHandler,
  changeWorkoutLetterHandler,
  getWorkoutHandler,
  completeWorkoutHandler,
  setSessionRpeHandler,
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

  // Fase 121 (levantamento do roadmap): trocar a letra (A-E) ou o dia da semana
  // da sessão. Antes só o NOME era editável, então mover um treino de "B" pra
  // "C" — ou de Segunda pra Quarta — exigia excluir e recriar, perdendo os
  // exercícios prescritos e o histórico de séries.
  fastify.patch(
    "/api/workouts/:id/letter",
    {
      preHandler: [(fastify as any).authenticate],
    },
    changeWorkoutLetterHandler
  );

  // Fase 120 (pedido do fundador): excluir a SESSÃO inteira do programa — o
  // "treino do dia" / dia da semana. Antes só existia excluir um EXERCÍCIO da
  // sessão (rota acima) ou o programa INTEIRO
  // (`DELETE /api/workout-programs/:id`), sem meio-termo: tirar uma sessão
  // errada obrigava a apagar e remontar o programa todo.
  fastify.delete(
    "/api/workouts/:id",
    {
      preHandler: [(fastify as any).authenticate],
    },
    deleteWorkoutHandler
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

  // Fase 112: RPE opcional, preenchido depois do resumo pós-treino — rota
  // própria (não aninhada em /workouts/:id) porque o recurso é o
  // WorkoutSessionLog, identificado pelo próprio id retornado por /complete.
  fastify.patch(
    "/api/workout-sessions/:sessionLogId/rpe",
    {
      preHandler: [(fastify as any).authenticate],
    },
    setSessionRpeHandler
  );
}
