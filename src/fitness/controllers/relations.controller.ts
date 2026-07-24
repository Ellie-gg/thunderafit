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

export async function setPaymentReminderHandler(
  request: FastifyRequest<{
    Params: { alunoId: string };
    Body: { dueDate: string | null; recurring?: boolean };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const role = (request as any).user.role;
  if (role !== "PERSONAL") {
    return reply
      .status(403)
      .send({ error: "Apenas Personal Trainers podem configurar lembretes de pagamento." });
  }

  const { alunoId } = request.params;
  const { dueDate, recurring } = request.body;

  let parsedDate: Date | null = null;
  if (dueDate) {
    parsedDate = new Date(dueDate);
    if (isNaN(parsedDate.getTime())) {
      return reply.status(400).send({ error: "dueDate inválida." });
    }
  }

  try {
    const relation = await relationsService.setPaymentReminder(
      personalId,
      alunoId,
      parsedDate,
      !!recurring
    );
    return reply.status(200).send({ relation });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function listRelationsHandler(
  request: FastifyRequest<{ Querystring: { personalId?: string } }>,
  reply: FastifyReply
) {
  const role = (request as any).user.role;
  // ADMIN não tem vínculos próprios — vê os de um profissional específico
  // via ?personalId=, visão ampliada da Fase 14, não impersonation (o admin
  // nunca assume a identidade do profissional consultado).
  const personalId =
    role === "ADMIN" && request.query.personalId
      ? request.query.personalId
      : (request as any).user.sub;

  try {
    const relations = await relationsService.listRelations(personalId);
    return reply.status(200).send({ relations });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
