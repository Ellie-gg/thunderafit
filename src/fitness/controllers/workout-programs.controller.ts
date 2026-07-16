import { FastifyRequest, FastifyReply } from "fastify";
import { workoutProgramsService } from "../services/workout-programs.service";

function handleError(err: any, reply: FastifyReply) {
  const status = err?.statusCode ?? 500;
  return reply.status(status).send({ error: err?.message ?? "Erro interno." });
}

function assertProfessional(request: FastifyRequest): void {
  const role = (request as any).user.role;
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    const err = new Error("Apenas profissionais podem gerenciar programas.") as any;
    err.statusCode = 403;
    throw err;
  }
}

export async function createProgramHandler(
  request: FastifyRequest<{ Body: { name: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const personalId = (request as any).user.sub;
    const program = await workoutProgramsService.createTemplate(personalId, request.body.name);
    return reply.status(201).send({ program });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function addSessionHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; letter: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const personalId = (request as any).user.sub;
    const { letter, name } = request.body;
    const session = await workoutProgramsService.addSession(request.params.id, personalId, name ?? "", letter);
    return reply.status(201).send({ session });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function applyProgramHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { alunoId: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const personalId = (request as any).user.sub;
    const program = await workoutProgramsService.apply(request.params.id, personalId, request.body.alunoId);
    return reply.status(201).send({ program });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function listProgramsHandler(
  request: FastifyRequest<{ Querystring: { type?: "template" | "instance" } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    // O aluno lista os programas aplicados a ele; o profissional lista os seus
    // (templates + instâncias, filtráveis por type).
    if (role === "ALUNO") {
      const programs = await workoutProgramsService.listForAluno(sub);
      return reply.status(200).send({ programs });
    }
    assertProfessional(request);
    const programs = await workoutProgramsService.listPrograms(sub, request.query.type);
    return reply.status(200).send({ programs });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function getProgramHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    const program = await workoutProgramsService.getProgram(request.params.id, sub, role);
    return reply.status(200).send({ program });
  } catch (err) {
    return handleError(err, reply);
  }
}
