import { FastifyRequest, FastifyReply } from "fastify";
import { relationsService } from "../services/relations.service";

export async function createRelationHandler(
  request: FastifyRequest<{
    Body: { alunoId: string };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const { alunoId } = request.body;

  try {
    const relation = await relationsService.createRelation(personalId, alunoId);
    return reply.status(201).send({ relation });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function listRelationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  try {
    const relations = await relationsService.listRelations(personalId);
    return reply.status(200).send({ relations });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
