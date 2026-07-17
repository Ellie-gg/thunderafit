import { FastifyRequest, FastifyReply } from "fastify";
import { connectionsService } from "../services/connections.service";

function handleError(err: any, reply: FastifyReply) {
  const status = err?.statusCode ?? 500;
  return reply.status(status).send({ error: err?.message ?? "Erro interno." });
}

export async function searchProfessionalsHandler(
  request: FastifyRequest<{ Querystring: { location?: string; role?: string } }>,
  reply: FastifyReply
) {
  try {
    // NUTRICIONISTA é tecnicamente suportado, mas a UI só expõe PERSONAL
    // (Fase 18). Default PERSONAL; só aceita os dois papéis profissionais.
    const role = request.query.role === "NUTRICIONISTA" ? "NUTRICIONISTA" : "PERSONAL";
    const professionals = await connectionsService.searchProfessionals(request.query.location, role);
    return reply.status(200).send({ professionals });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function getMyProfileHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const profile = await connectionsService.getMyProfile((request as any).user.sub);
    return reply.status(200).send({ profile });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function updateMyProfileHandler(
  request: FastifyRequest<{
    Body: { availableForNewStudents?: boolean; location?: string | null; bio?: string | null };
  }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    const profile = await connectionsService.updateMyProfile(sub, role, request.body ?? {});
    return reply.status(200).send({ profile });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function createRequestHandler(
  request: FastifyRequest<{ Body: { professionalId?: string } }>,
  reply: FastifyReply
) {
  const { sub, role } = (request as any).user;
  if (role !== "ALUNO") {
    return reply.status(403).send({ error: "Apenas alunos podem solicitar vínculo." });
  }
  try {
    const created = await connectionsService.createRequest(sub, request.body?.professionalId ?? "");
    return reply.status(201).send({ request: created });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function listRequestsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { sub, role } = (request as any).user;
    const requests = await connectionsService.listRequests(sub, role);
    return reply.status(200).send({ requests });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function acceptRequestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { sub, role } = (request as any).user;
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas profissionais respondem solicitações." });
  }
  try {
    const updated = await connectionsService.acceptRequest(request.params.id, sub);
    return reply.status(200).send({ request: updated });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function rejectRequestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { sub, role } = (request as any).user;
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas profissionais respondem solicitações." });
  }
  try {
    const updated = await connectionsService.rejectRequest(request.params.id, sub);
    return reply.status(200).send({ request: updated });
  } catch (err) {
    return handleError(err, reply);
  }
}
