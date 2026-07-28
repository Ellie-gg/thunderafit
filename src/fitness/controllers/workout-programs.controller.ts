import { FastifyRequest, FastifyReply } from "fastify";
import { SessionScheme } from "@prisma/client";
import { workoutProgramsService } from "../services/workout-programs.service";
import { resolveRequestLocale } from "../../lib/locale";

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
  request: FastifyRequest<{ Body: { name: string; sessionScheme?: SessionScheme } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const personalId = (request as any).user.sub;
    const program = await workoutProgramsService.createTemplate(
      personalId,
      request.body.name,
      request.body.sessionScheme
    );
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
  request: FastifyRequest<{ Querystring: { type?: "template" | "instance"; alunoId?: string } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    // O aluno lista os programas aplicados a ele; o profissional lista os seus
    // (templates + instâncias, filtráveis por type e, opcionalmente, por
    // alunoId — Fase 29, hub de administração do aluno).
    if (role === "ALUNO") {
      const programs = await workoutProgramsService.listForAluno(sub);
      return reply.status(200).send({ programs });
    }
    assertProfessional(request);
    const programs = await workoutProgramsService.listPrograms(
      sub,
      request.query.type,
      request.query.alunoId
    );
    return reply.status(200).send({ programs });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function deleteProgramHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    // Fase 85: aluno excluindo o PRÓPRIO treino (origin: SELF) é um caminho
    // novo — ramifica aqui em vez de duplicar a rota, mesmo padrão já usado
    // em listProgramsHandler acima (um endpoint, comportamento por role).
    // O caminho do Personal abaixo (assertProfessional + deleteProgram)
    // continua 100% inalterado.
    if (role === "ALUNO") {
      await workoutProgramsService.deleteSelfProgram(request.params.id, sub);
      return reply.status(204).send();
    }
    assertProfessional(request);
    await workoutProgramsService.deleteProgram(request.params.id, sub);
    return reply.status(204).send();
  } catch (err) {
    return handleError(err, reply);
  }
}

// Fase 34.5: catálogo de templates "Meu treino pessoal" — qualquer usuário
// autenticado pode ver (a tela em si só é oferecida ao ALUNO no frontend,
// mas não há dado sensível aqui pra restringir por role no backend).
export async function saveInstanceAsTemplateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const personalId = (request as any).user.sub;
    const program = await workoutProgramsService.saveInstanceAsTemplate(
      request.params.id,
      personalId,
      request.body.name
    );
    return reply.status(201).send({ program });
  } catch (err) {
    return handleError(err, reply);
  }
}

// Fase 62: catálogo de templates pro Personal (Básico + Premium).
export async function listPersonalCatalogHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertProfessional(request);
    const programs = await workoutProgramsService.listPersonalCatalog(resolveRequestLocale(request));
    return reply.status(200).send({ programs });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function applyCatalogTemplateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { alunoId: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const personalId = (request as any).user.sub;
    const program = await workoutProgramsService.applyCatalogTemplate(
      request.params.id,
      personalId,
      request.body.alunoId
    );
    return reply.status(201).send({ program });
  } catch (err: any) {
    if (err.code === "PREMIUM_TEMPLATE_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return handleError(err, reply);
  }
}

export async function listSelfTemplatesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const programs = await workoutProgramsService.listSelfTemplates(resolveRequestLocale(request));
    return reply.status(200).send({ programs });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function applySelfTemplateHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { replace?: boolean } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    if (role !== "ALUNO") {
      const err = new Error("Apenas alunos podem aplicar um treino pessoal.") as any;
      err.statusCode = 403;
      throw err;
    }
    const program = await workoutProgramsService.applySelfTemplate(
      request.params.id,
      sub,
      request.body?.replace === true
    );
    return reply.status(201).send({ program });
  } catch (err: any) {
    // Fase 52: conflito de "1 treino pessoal ativo por vez" carrega dados
    // extras (código + programa atual) pro frontend montar o diálogo de
    // confirmação — o handleError genérico só devolve {error}, insuficiente
    // aqui.
    if (err.code === "SELF_PROGRAM_EXISTS") {
      return reply.status(409).send({
        error: err.message,
        code: err.code,
        existingProgramId: err.existingProgramId,
        existingProgramName: err.existingProgramName,
      });
    }
    // Fase 56: gate de Aluno Premium — code carrega pro frontend distinguir
    // "sem acesso Premium" de qualquer outro erro genérico (mesmo motivo do
    // SELF_PROGRAM_EXISTS acima).
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return handleError(err, reply);
  }
}

// Fase 85 — Aluno Premium monta o próprio treino do zero (schema/regras
// idênticas ao já usado por applySelfTemplateHandler abaixo: mesmos códigos
// de erro SELF_PROGRAM_EXISTS/PREMIUM_REQUIRED, mesmo formato de resposta).
export async function createSelfProgramHandler(
  request: FastifyRequest<{
    Body: { name: string; sessionScheme?: SessionScheme; replace?: boolean };
  }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    if (role !== "ALUNO") {
      const err = new Error("Apenas alunos podem montar o próprio treino.") as any;
      err.statusCode = 403;
      throw err;
    }
    const program = await workoutProgramsService.createSelfProgram(
      sub,
      request.body.name,
      request.body.sessionScheme,
      request.body.replace === true
    );
    return reply.status(201).send({ program });
  } catch (err: any) {
    if (err.code === "SELF_PROGRAM_EXISTS") {
      return reply.status(409).send({
        error: err.message,
        code: err.code,
        existingProgramId: err.existingProgramId,
        existingProgramName: err.existingProgramName,
      });
    }
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return handleError(err, reply);
  }
}

export async function addSelfSessionHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; letter: string } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    if (role !== "ALUNO") {
      const err = new Error("Apenas alunos podem editar o próprio treino.") as any;
      err.statusCode = 403;
      throw err;
    }
    const { letter, name } = request.body;
    const session = await workoutProgramsService.addSelfSession(request.params.id, sub, name ?? "", letter);
    return reply.status(201).send({ session });
  } catch (err: any) {
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return handleError(err, reply);
  }
}

export async function getProgramHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { sub, role } = (request as any).user;
    const program = await workoutProgramsService.getProgram(
      request.params.id,
      sub,
      role,
      resolveRequestLocale(request)
    );
    return reply.status(200).send({ program });
  } catch (err) {
    return handleError(err, reply);
  }
}
