import { FastifyRequest, FastifyReply } from "fastify";
import { adminService } from "../services/admin.service";

function assertAdmin(request: FastifyRequest): void {
  const user = (request as any).user;
  if (user.role !== "ADMIN") {
    const err = new Error("Acesso restrito a administradores.");
    (err as any).statusCode = 403;
    throw err;
  }
}

function handleError(err: any, reply: FastifyReply) {
  const status = err.statusCode ?? 500;
  return reply.status(status).send({ error: err.message });
}

export async function overviewHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertAdmin(request);
    const overview = await adminService.getOverview();
    return reply.status(200).send(overview);
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: { role?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply
) {
  try {
    assertAdmin(request);
    const { role, page, pageSize } = request.query;
    const result = await adminService.listUsers({
      role,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    return reply.status(200).send(result);
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function listLoginsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertAdmin(request);
    const logins = await adminService.listRecentLogins();
    return reply.status(200).send({ logins });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function supportSlaHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertAdmin(request);
    const threads = await adminService.getSupportSla();
    return reply.status(200).send({ threads });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function accessLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertAdmin(request);
    const [logs, auditLogs] = await Promise.all([
      adminService.listAccessLogs(),
      adminService.listAuditLogs(),
    ]);
    return reply.status(200).send({ logs, auditLogs });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function updateExerciseMediaHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { mediaType?: string; mediaDataUrl?: string; youtubeUrl?: string };
  }>,
  reply: FastifyReply
) {
  try {
    assertAdmin(request);
    const exercise = await adminService.updateExerciseMedia(request.params.id, request.body);
    return reply.status(200).send({ exercise });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

type ExerciseCrudBody = {
  name?: string;
  muscleGroup?: string;
  equipment?: string;
  description?: string;
  difficultyLevel?: string;
  confirmSimilarName?: boolean;
  isFeatured?: boolean;
};

export async function listAdminExercisesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertAdmin(request);
    const exercises = await adminService.listExercisesForAdmin();
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function createExerciseHandler(
  request: FastifyRequest<{ Body: ExerciseCrudBody }>,
  reply: FastifyReply
) {
  try {
    assertAdmin(request);
    const result = await adminService.createExercise(request.body);
    return reply.status(200).send(result);
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function updateExerciseHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: ExerciseCrudBody }>,
  reply: FastifyReply
) {
  try {
    assertAdmin(request);
    const result = await adminService.updateExercise(request.params.id, request.body);
    return reply.status(200).send(result);
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function deleteExerciseHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    assertAdmin(request);
    const result = await adminService.deleteExercise(request.params.id);
    return reply.status(200).send(result);
  } catch (err: any) {
    return handleError(err, reply);
  }
}

export async function updateUserRoleHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { role?: string } }>,
  reply: FastifyReply
) {
  try {
    assertAdmin(request);
    const adminId = (request as any).user.sub;
    const result = await adminService.updateUserRole(adminId, request.params.id, request.body.role);
    return reply.status(200).send(result);
  } catch (err: any) {
    return handleError(err, reply);
  }
}
