import { FastifyInstance } from "fastify";
import { listExercisesHandler } from "../controllers/exercises.controller";

/**
 * Perf (triagem 2026-07-29, item de alto impacto): único response schema do
 * backend até agora — a resposta mais pesada/mais lida do app (~171
 * exercícios em toda tela de prescrição). Um `schema.response` no Fastify
 * compila a serialização via `fast-json-stringify` em vez do
 * `JSON.stringify` genérico, E funciona como ALLOWLIST — qualquer campo
 * fora daqui é descartado silenciosamente na resposta. Por isso replicar
 * EXATAMENTE o `select` de `exercises.repository.ts#fetchFullCatalog` era
 * obrigatório aqui (não adivinhado). `getProgram`/`getWorkout` (o outro alvo
 * de alto payload identificado na triagem) ficaram de fora de propósito —
 * têm campos aninhados profundos e evoluindo há dezenas de fases; escrever
 * o schema errado lá silenciaria dado de verdade, não só otimizaria — fica
 * documentado como próxima fase, exigindo mapeamento campo-a-campo cuidadoso.
 */
const exerciseItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    muscleGroup: { type: "string" },
    equipment: { type: "string" },
    mediaUrl: { type: ["string", "null"] },
    mediaType: { type: "string", enum: ["YOUTUBE", "VIDEO", "GIF"] },
    description: { type: "string" },
    difficultyLevel: { type: "string", enum: ["INICIANTE", "INTERMEDIARIO", "AVANCADO"] },
    isFeatured: { type: "boolean" },
  },
};

export async function exercisesRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/exercises",
    {
      preHandler: [(fastify as any).authenticate],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              exercises: { type: "array", items: exerciseItemSchema },
            },
          },
        },
      },
    },
    listExercisesHandler
  );
}
