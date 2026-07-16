import { FastifyRequest, FastifyReply } from "fastify";
import { Role } from "@prisma/client";
import * as authService from "../services/auth.service";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15min, espelha ACCESS_TOKEN_EXPIRY
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7d, espelha REFRESH_TOKEN_EXPIRY

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

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

  try {
    const result = await authService.login({ email, password });
    setAuthCookies(reply, result.accessToken, result.refreshToken);
    return reply.status(200).send(result);
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  }
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
