import { FastifyInstance } from "fastify";
import { getAlunoDashboardHandler } from "../controllers/dashboard.controller";

export async function dashboardRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  // Fase 96 (triagem de perf 2026-07-29): resumo do dashboard do Aluno num
  // único round trip — ver dashboard.service.ts.
  fastify.get("/api/dashboard/aluno-summary", auth, getAlunoDashboardHandler);
}
