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
    const logs = await adminService.listAccessLogs();
    return reply.status(200).send({ logs });
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
