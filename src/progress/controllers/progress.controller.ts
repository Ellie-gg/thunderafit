import { FastifyRequest, FastifyReply } from "fastify";
import { progressService } from "../services/progress.service";
import { progressRepository } from "../repository/progress.repository";

/**
 * Resolve de quem é o histórico de evolução pedido, por role.
 *
 * Bugs potenciais considerados antes de escrever esta função:
 * - esquecer de tornar a função `async` (o novo ramo PERSONAL/NUTRICIONISTA
 *   precisa consultar o banco) e deixar os 3 handlers chamando sem `await` —
 *   todos os 3 call sites abaixo foram atualizados junto.
 * - deixar PERSONAL/NUTRICIONISTA cair sem checar `alunoId` ausente antes de
 *   consultar `findRelation(personalId, undefined)` — undefined explícito
 *   evitado com o mesmo guard de 400 que o ADMIN já tem.
 * - ordem dos `if`: ADMIN primeiro (sem checagem de vínculo, por design da
 *   Fase 14), depois PERSONAL/NUTRICIONISTA (COM checagem de vínculo — sem
 *   isso, qualquer profissional veria a evolução de qualquer aluno do
 *   sistema, vinculado ou não — um IDOR real), e só então o fallback ALUNO
 *   (ignora qualquer `alunoId` da query, sempre usa o próprio `user.sub`).
 * - reaproveitar a MESMA mensagem de "não vinculado" do domínio anamnesis
 *   (`getForProfessional`), pra consistência de erro entre os dois domínios
 *   que já têm essa checagem.
 */
async function assertAluno(
  request: FastifyRequest<{ Querystring: { alunoId?: string } }>
): Promise<string> {
  const user = (request as any).user;

  if (user.role === "ADMIN") {
    if (!request.query.alunoId) {
      const err = new Error("alunoId é obrigatório para consulta administrativa.");
      (err as any).statusCode = 400;
      throw err;
    }
    return request.query.alunoId;
  }

  if (user.role === "PERSONAL" || user.role === "NUTRICIONISTA") {
    if (!request.query.alunoId) {
      const err = new Error("alunoId é obrigatório.");
      (err as any).statusCode = 400;
      throw err;
    }
    const relation = await progressRepository.findRelation(user.sub, request.query.alunoId);
    if (!relation) {
      const err = new Error("Este aluno não está vinculado a você.");
      (err as any).statusCode = 403;
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
    const alunoId = await assertAluno(request);
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
    const alunoId = await assertAluno(request);
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
    const alunoId = await assertAluno(request);
    const exercises = await progressService.getLoggedExercises(alunoId);
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
