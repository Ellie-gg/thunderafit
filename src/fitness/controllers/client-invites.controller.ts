import { FastifyRequest, FastifyReply } from "fastify";
import { clientInvitesService } from "../services/client-invites.service";
import * as loginRateLimiter from "../../auth/services/login-rate-limiter";

function handleError(err: any, reply: FastifyReply) {
  const status = err?.statusCode ?? 500;
  return reply.status(status).send({ error: err?.message ?? "Erro interno." });
}

function assertProfessional(request: FastifyRequest): void {
  const role = (request as any).user.role;
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    const err = new Error("Apenas Personal Trainers ou Nutricionistas podem gerenciar convites.") as any;
    err.statusCode = 403;
    throw err;
  }
}

export async function createInviteHandler(
  request: FastifyRequest<{ Body: { label?: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const { sub, role } = (request as any).user;
    const result = await clientInvitesService.createInvite(sub, role, request.body?.label ?? "");
    return reply.status(201).send(result);
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function listInvitesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    assertProfessional(request);
    const { sub } = (request as any).user;
    const invites = await clientInvitesService.listInvites(sub);
    return reply.status(200).send({ invites });
  } catch (err) {
    return handleError(err, reply);
  }
}

export async function revokeInviteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    assertProfessional(request);
    const { sub } = (request as any).user;
    await clientInvitesService.revokeInvite(sub, request.params.id);
    return reply.status(204).send();
  } catch (err) {
    return handleError(err, reply);
  }
}

/**
 * Pública — quem abre o link do convite ainda não tem sessão neste
 * dispositivo. Rate-limitada por IP (mesmo padrão de verify-email/
 * reset-password em auth.controller.ts) — o token em si já tem 256 bits de
 * entropia (força bruta inviável), o freio é só defesa a mais contra abuso
 * simples do endpoint.
 */
export async function previewInviteHandler(
  request: FastifyRequest<{ Querystring: { token?: string } }>,
  reply: FastifyReply
) {
  const token = request.query.token;
  if (!token) {
    return reply.status(400).send({ error: "token é obrigatório." });
  }

  const ip = request.ip;
  const blockStatus = loginRateLimiter.isBlocked(ip, token);
  if (blockStatus.blocked) {
    return reply.status(429).send({
      error: `Muitas tentativas. Tente novamente em ${blockStatus.retryAfterSeconds}s.`,
    });
  }
  loginRateLimiter.recordFailedAttempt(ip, token);

  const result = await clientInvitesService.previewInvite(token);
  return reply.status(200).send(result);
}
