import { FastifyRequest, FastifyReply } from "fastify";
import { progressService } from "../services/progress.service";

// ADMIN não tem histórico próprio de treino — passa ?alunoId= para ver a
// evolução de um aluno específico (visão ampliada, Fase 14), sem assumir a
// identidade do aluno.
function assertAluno(request: FastifyRequest<{ Querystring: { alunoId?: string } }>): string {
  const user = (request as any).user;
  if (user.role === "ADMIN") {
    if (!request.query.alunoId) {
      const err = new Error("alunoId é obrigatório para consulta administrativa.");
      (err as any).statusCode = 400;
      throw err;
    }
    return request.query.alunoId;
  }
  if (user.role !== "ALUNO") {
    const err = new Error("Apenas alunos podem acessar o histórico de evolução.");
    (err as any).statusCode = 403;
    throw err;
  }
  return user.sub;
}

export async function loadHistoryHandler(
  request: FastifyRequest<{ Querystring: { exerciseId?: string; alunoId?: string } }>,
  reply: FastifyReply
) {
  try {
    const alunoId = assertAluno(request);
    const { exerciseId } = request.query;

    if (!exerciseId) {
      return reply.status(400).send({ error: "exerciseId é obrigatório." });
    }

    const result = await progressService.getLoadHistory(alunoId, exerciseId);
    return reply.status(200).send(result);
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function frequencyHandler(
  request: FastifyRequest<{ Querystring: { period?: string; alunoId?: string } }>,
  reply: FastifyReply
) {
  try {
    const alunoId = assertAluno(request);
    const period = request.query.period ?? "6m";

    const result = await progressService.getFrequency(alunoId, period);
    return reply.status(200).send(result);
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function listLoggedExercisesHandler(
  request: FastifyRequest<{ Querystring: { alunoId?: string } }>,
  reply: FastifyReply
) {
  try {
    const alunoId = assertAluno(request);
    const exercises = await progressService.getLoggedExercises(alunoId);
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
