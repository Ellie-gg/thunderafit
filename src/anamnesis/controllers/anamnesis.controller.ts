import { FastifyRequest, FastifyReply } from "fastify";
import { anamnesisService } from "../services/anamnesis.service";
import type { AnamnesisInput } from "../repository/anamnesis.repository";

function handleError(err: any, reply: FastifyReply) {
  const status = err.statusCode ?? 500;
  return reply.status(status).send({ error: err.message });
}

export async function getAnamnesisHandler(
  request: FastifyRequest<{ Querystring: { alunoId?: string } }>,
  reply: FastifyReply
) {
  const user = (request as any).user;
  const { alunoId } = request.query;

  try {
    if (alunoId) {
      // Visão do Personal sobre o aluno vinculado.
      if (user.role !== "PERSONAL") {
        return reply.status(403).send({ error: "Apenas o Personal pode consultar por alunoId." });
      }
      const anamnesis = await anamnesisService.getForPersonal(user.sub, alunoId);
      return reply.status(200).send({ anamnesis });
    }

    if (user.role !== "ALUNO") {
      return reply.status(403).send({ error: "Apenas o aluno pode ver a própria anamnese." });
    }
    const anamnesis = await anamnesisService.getOwn(user.sub);
    return reply.status(200).send({ anamnesis });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function createAnamnesisHandler(
  request: FastifyRequest<{ Body: AnamnesisInput }>,
  reply: FastifyReply
) {
  const user = (request as any).user;
  if (user.role !== "ALUNO") {
    return reply.status(403).send({ error: "Apenas o aluno pode criar a própria anamnese." });
  }
  try {
    const anamnesis = await anamnesisService.create(user.sub, request.body);
    return reply.status(201).send({ anamnesis });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function updateAnamnesisHandler(
  request: FastifyRequest<{ Body: AnamnesisInput }>,
  reply: FastifyReply
) {
  const user = (request as any).user;
  if (user.role !== "ALUNO") {
    return reply.status(403).send({ error: "Apenas o aluno pode editar a própria anamnese." });
  }
  try {
    const anamnesis = await anamnesisService.update(user.sub, request.body);
    return reply.status(200).send({ anamnesis });
  } catch (err: any) {
    return handleError(err, reply);
  }
}
