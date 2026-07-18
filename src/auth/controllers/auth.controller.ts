import { FastifyRequest, FastifyReply } from "fastify";
import { Role } from "@prisma/client";
import * as authService from "../services/auth.service";
import * as loginRateLimiter from "../services/login-rate-limiter";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15min, espelha ACCESS_TOKEN_EXPIRY
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7d, espelha REFRESH_TOKEN_EXPIRY

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Não existia validação de formato de e-mail em nenhum lugar do domínio
// (register só checava presença) — criada aqui para o check-email e reutilizável.
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fase 24 (correção pós-Parte 1): a chave do limiter é (IP, e-mail), igual ao
// login — NÃO uma chave fixa por IP. Em produção o backend só vê o IP do
// proxy do frontend (mesmo motivo documentado no rate limiter de login); uma
// chave fixa por IP compartilharia um único balde de 5 chamadas/15min entre
// TODOS os usuários reais atrás do proxy, bloqueando gente de verdade após
// poucos cadastros/logins. Com (IP, e-mail), cada e-mail testado tem seu
// próprio balde — a defesa anti-enumeração fica mais fraca (dá pra variar o
// e-mail), mas é a mesma postura de risco já aceita no limiter de login.

/**
 * Cookie httpOnly passa a ser a fonte de verdade para o frontend web
 * (Fase 5.5). O corpo da resposta continua retornando os tokens em texto
 * plano por compatibilidade com clients não-browser (curl/Postman/mobile).
 */
function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  reply.setCookie("access_token", accessToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
  reply.setCookie("refresh_token", refreshToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie("access_token", { path: "/" });
  reply.clearCookie("refresh_token", { path: "/" });
}

export async function registerHandler(
  request: FastifyRequest<{
    Body: { email: string; password: string; role: Role };
  }>,
  reply: FastifyReply
) {
  const { email, password, role } = request.body;

  if (!email || !password || !role) {
    return reply.status(400).send({ error: "email, password e role são obrigatórios." });
  }

  if (!["PERSONAL", "ALUNO", "NUTRICIONISTA"].includes(role)) {
    return reply.status(400).send({ error: "role deve ser PERSONAL, ALUNO ou NUTRICIONISTA." });
  }

  try {
    const user = await authService.register({ email, password, role });
    return reply.status(201).send({ user });
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  }
}

export async function loginHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply
) {
  const { email, password } = request.body;

  if (!email || !password) {
    return reply.status(400).send({ error: "email e password são obrigatórios." });
  }

  const ip = request.ip;
  const blockStatus = loginRateLimiter.isBlocked(ip, email);
  if (blockStatus.blocked) {
    return reply.status(429).send({
      error: `Muitas tentativas de login inválidas. Tente novamente em ${blockStatus.retryAfterSeconds}s.`,
    });
  }

  try {
    const result = await authService.login({ email, password }, ip);
    loginRateLimiter.recordSuccessfulAttempt(ip, email);
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return reply.status(200).send(result);
  } catch (err) {
    loginRateLimiter.recordFailedAttempt(ip, email);
    const error = err as Error & { statusCode?: number };
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  }
}

/**
 * Checagem pública de existência de e-mail (Fase 24 — auth unificado).
 * Resposta é SEMPRE { exists: boolean }, nunca outro dado do usuário, mesmo
 * quando ele existe. Sem autenticação; protegida pelo rate limiter de login
 * (Fase 14) por IP para dificultar enumeração de e-mails.
 */
export async function checkEmailHandler(
  request: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply
) {
  const { email } = request.body;

  if (!email || !EMAIL_FORMAT_REGEX.test(email)) {
    return reply.status(400).send({ error: "email é obrigatório e deve ter um formato válido." });
  }

  const ip = request.ip;
  const blockStatus = loginRateLimiter.isBlocked(ip, email);
  if (blockStatus.blocked) {
    return reply.status(429).send({
      error: `Muitas verificações de e-mail. Tente novamente em ${blockStatus.retryAfterSeconds}s.`,
    });
  }
  loginRateLimiter.recordFailedAttempt(ip, email);

  const exists = await authService.checkEmailExists(email);
  return reply.status(200).send({ exists });
}

export async function refreshHandler(
  request: FastifyRequest<{ Body: { refreshToken?: string } }>,
  reply: FastifyReply
) {
  // O frontend web (cookie httpOnly) não consegue ler o refresh token para
  // mandar no corpo — cai no cookie. Clients não-browser continuam mandando
  // no corpo normalmente.
  const refreshToken = request.body?.refreshToken ?? request.cookies?.refresh_token;

  if (!refreshToken) {
    return reply.status(400).send({ error: "refreshToken é obrigatório." });
  }

  try {
    const result = await authService.refresh(refreshToken);
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return reply.status(200).send(result);
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  }
}

/**
 * Fase 30: atualiza (ou remove, com `avatarDataUrl: null`) a foto de perfil
 * do usuário autenticado. Qualquer role (aluno ou profissional) — não é
 * dado específico de nenhum domínio, só do próprio usuário.
 */
export async function updateAvatarHandler(
  request: FastifyRequest<{ Body: { avatarDataUrl?: string | null } }>,
  reply: FastifyReply
) {
  const user = (request as FastifyRequest & { user?: { sub: string } }).user;
  if (!user) {
    return reply.status(401).send({ error: "Não autenticado." });
  }

  // `avatarDataUrl` precisa estar PRESENTE no body (string pra atualizar,
  // null pra remover) — campo ausente é erro, não é tratado como "sem
  // mudança" silenciosa.
  if (request.body?.avatarDataUrl === undefined) {
    return reply.status(400).send({ error: "avatarDataUrl é obrigatório (ou null para remover)." });
  }

  try {
    const updatedUser = await authService.updateAvatar(user.sub, request.body.avatarDataUrl);
    return reply.status(200).send({ user: updatedUser });
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  }
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as FastifyRequest & { user?: { sub: string } }).user;
  if (user) {
    await authService.logout(user.sub);
  }
  clearAuthCookies(reply);
  return reply.status(200).send({ message: "Logout realizado." });
}

/**
 * Rota de teste para validar o middleware de autenticação.
 * Será protegida pelo middleware `authenticate`.
 */
export async function protectedHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.status(200).send({
    message: "Acesso autorizado.",
    user: (request as FastifyRequest & { user?: unknown }).user,
  });
}
