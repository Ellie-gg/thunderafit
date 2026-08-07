import { FastifyInstance } from "fastify";
import {
  loadHistoryHandler,
  frequencyHandler,
  listLoggedExercisesHandler,
  weeklySummaryHandler,
  sessionHistoryHandler,
  personalRecordsHandler,
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

  fastify.get(
    "/api/progress/weekly-summary",
    { preHandler: [(fastify as any).authenticate] },
    weeklySummaryHandler
  );

  // Fase 112: tendência de sessões (duração/volume/carga de treino) +
  // distribuição de esforço (RPE) — fundação do dashboard histórico.
  fastify.get(
    "/api/progress/session-history",
    { preHandler: [(fastify as any).authenticate] },
    sessionHistoryHandler
  );

  // Fase 121 ("meus recordes"): maior carga por exercício. Derivado do SetLog
  // na leitura — não existe tabela de PR, de propósito (ver o repository).
  fastify.get(
    "/api/progress/personal-records",
    { preHandler: [(fastify as any).authenticate] },
    personalRecordsHandler
  );
}
