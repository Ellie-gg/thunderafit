import { FastifyInstance } from "fastify";
import {
  listBodyMeasurementsHandler,
  createBodyMeasurementHandler,
  deleteBodyMeasurementHandler,
} from "../controllers/body.controller";

/**
 * Fase 121: histórico de medições corporais.
 *
 * Domínio novo (não entrou em `anamnesis`) porque a semântica é diferente:
 * `Anamnesis` é o questionário de ENTRADA, 1:1 com o aluno e sobrescrito;
 * `BodyMeasurement` é série temporal, N por aluno, e o Personal também escreve.
 *
 * `?alunoId=` opcional, mesmo contrato dos endpoints de `/api/progress`: o aluno
 * ignora o parâmetro (lê sempre o próprio), o profissional precisa dele e passa
 * por checagem de vínculo.
 */
export async function bodyRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.get("/api/body-measurements", auth, listBodyMeasurementsHandler);
  fastify.post("/api/body-measurements", auth, createBodyMeasurementHandler);
  fastify.delete("/api/body-measurements/:id", auth, deleteBodyMeasurementHandler);
}
