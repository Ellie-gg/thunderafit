import { FastifyRequest, FastifyReply } from "fastify";
import { supportService } from "../services/support.service";

function handleError(err: any, reply: FastifyReply) {
  const status = err.statusCode ?? 500;
  return reply.status(status).send({ error: err.message });
}

export async function listMyPersonalsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (user.role !== "ALUNO") {
    return reply.status(403).send({ error: "Apenas alunos têm Personals vinculados." });
  }
  const personals = await supportService.listMyPersonals(user.sub);
  return reply.status(200).send({ personals });
}

export async function createThreadHandler(
  request: FastifyRequest<{ Body: { personalId: string; subject: string; message: string } }>,
  reply: FastifyReply
) {
  const user = (request as any).user;
  if (user.role !== "ALUNO") {
    return reply.status(403).send({ error: "Apenas alunos podem abrir uma dúvida." });
  }
  const { personalId, subject, message } = request.body;
  if (!personalId || !subject || !message) {
    return reply.status(400).send({ error: "personalId, subject e message são obrigatórios." });
  }

  try {
    const thread = await supportService.createThread(user.sub, personalId, subject, message);
    return reply.status(201).send({ thread });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function listThreadsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  const threads = await supportService.listThreads(user.sub, user.role);
  return reply.status(200).send({ threads });
}

export async function getThreadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = (request as any).user;
  try {
    const thread = await supportService.getThread(request.params.id, user.sub);
    return reply.status(200).send({ thread });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function addMessageHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { text: string } }>,
  reply: FastifyReply
) {
  const user = (request as any).user;
  const { text } = request.body;
  if (!text) {
    return reply.status(400).send({ error: "text é obrigatório." });
  }

  try {
    const message = await supportService.addMessage(request.params.id, user.sub, user.role, text);
    return reply.status(201).send({ message });
  } catch (err: any) {
    return handleError(err, reply);
  }
}
