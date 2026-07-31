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
 * Fase 104 (correção pós-lançamento) — achado real em produção: quem abre
 * o link do convite já LOGADO em outro momento (sessão existente no
 * navegador) via register/login/SSO nunca roda de novo — a página só
 * consumia o convite dentro daquele fluxo de autenticação. Resultado: o
 * aluno ficava "órfão" (cadastro existe, vínculo nunca acontece), e a
 * única pista era o link pedir login de novo mesmo já autenticado.
 * Autenticada — consome o convite pra quem já está logado agora, sem
 * pedir senha de novo. Só ALUNO consome (mesma regra do register/login).
 */
export async function consumeInviteHandler(
  request: FastifyRequest<{ Body: { token?: string } }>,
  reply: FastifyReply
) {
  const { sub, role } = (request as any).user;
  const token = request.body?.token;
  if (!token) {
    return reply.status(400).send({ error: "token é obrigatório." });
  }
  if (role !== "ALUNO") {
    return reply.status(403).send({
      error: "Este convite é pra virar aluno de um profissional — sua conta atual não é uma conta de aluno.",
    });
  }

  const result = await clientInvitesService.consumeInvite(token, sub);
  if (!result.consumed) {
    return reply.status(400).send({ error: result.reason ?? "Não foi possível concluir o vínculo." });
  }
  return reply.status(200).send({ consumed: true });
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

  const result = await clientInvitesService.previewInvite(token);
  // F9 (auditoria 2026-07-31): antes, TODA chamada contava como "tentativa
  // falha" incondicionalmente — mesmo um token válido. Quem abre o link do
  // convite, sai da tela e volta (recarregando `/login?invite=`) algumas
  // vezes levava 429 na 5ª abertura, sem nenhum token errado ter sido
  // tentado. Só um token de fato inválido/expirado conta como tentativa —
  // um convite válido sendo visualizado repetidas vezes não é abuso.
  if (result.valid) {
    loginRateLimiter.recordSuccessfulAttempt(ip, token);
  } else {
    loginRateLimiter.recordFailedAttempt(ip, token);
  }
  return reply.status(200).send(result);
}
