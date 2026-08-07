import { FastifyRequest, FastifyReply } from "fastify";
import { Role } from "@prisma/client";
import { bodyService, type BodyMeasurementInput } from "../services/body.service";

function errStatus(err: any): number {
  return err?.statusCode ?? 500;
}

function actor(request: FastifyRequest): { userId: string; role: Role } {
  const user = (request as any).user;
  return { userId: user.sub, role: user.role as Role };
}

export async function listBodyMeasurementsHandler(
  request: FastifyRequest<{ Querystring: { alunoId?: string; take?: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId, role } = actor(request);
    const take = Number(request.query.take);
    const result = await bodyService.list(userId, role, request.query.alunoId, take);
    return reply.status(200).send(result);
  } catch (err: any) {
    return reply.status(errStatus(err)).send({ error: err.message });
  }
}

export async function createBodyMeasurementHandler(
  request: FastifyRequest<{
    Querystring: { alunoId?: string };
    Body: BodyMeasurementInput;
  }>,
  reply: FastifyReply
) {
  try {
    const { userId, role } = actor(request);
    // B3 (auditoria 2026-08-06): `?? {}` — corpo ausente não pode virar 500.
    const result = await bodyService.create(userId, role, request.query.alunoId, request.body ?? {});
    return reply.status(201).send(result);
  } catch (err: any) {
    return reply.status(errStatus(err)).send({ error: err.message });
  }
}

export async function deleteBodyMeasurementHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId, role } = actor(request);
    const result = await bodyService.remove(userId, role, request.params.id);
    return reply.status(200).send(result);
  } catch (err: any) {
    return reply.status(errStatus(err)).send({ error: err.message });
  }
}
