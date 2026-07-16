import { FastifyRequest, FastifyReply } from "fastify";
import { relationsService } from "../services/relations.service";

export async function createRelationHandler(
  request: FastifyRequest<{
    Body: { alunoId: string };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { alunoId } = request.body;

  // professionalType é inferido do role de quem está autenticado, nunca
  // aceito do cliente — evita que um aluno (ou um Nutricionista se passando
  // por Personal) vincule um professionalType arbitrário.
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas Personal Trainers ou Nutricionistas podem vincular alunos." });
  }

  try {
    const relation = await relationsService.createRelation(personalId, alunoId, role);
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
