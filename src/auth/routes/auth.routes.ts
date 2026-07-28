import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  registerHandler,
  loginHandler,
  googleAuthHandler,
  refreshHandler,
  logoutHandler,
  protectedHandler,
  checkEmailHandler,
  updateAvatarHandler,
  changePasswordHandler,
  resendVerificationEmailHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  deleteMyAccountHandler,
  updateLocaleHandler,
} from "../controllers/auth.controller";

type AuthenticateFn = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

export async function authRoutes(fastify: FastifyInstance) {
  // Registro
  fastify.post("/api/auth/register", registerHandler);

  // Login
  fastify.post("/api/auth/login", loginHandler);

  // Fase 77: SSO Google — login se a conta já existir (vincula por e-mail
  // verificado), ou pede `role` pra criar uma conta nova (needsRole: true).
  fastify.post("/api/auth/google", googleAuthHandler);

  // Checagem de existência de e-mail (fluxo de auth unificado, Fase 24) —
  // pública, sem preHandler de auth.
  fastify.post("/api/auth/check-email", checkEmailHandler);

  // Refresh de tokens
  fastify.post("/api/auth/refresh", refreshHandler);

  // Logout — invalida o refresh token no banco e limpa os cookies httpOnly
  fastify.post(
    "/api/auth/logout",
    {
      preHandler: [
        (fastify as FastifyInstance & { authenticate: AuthenticateFn })
          .authenticate,
      ],
    },
    logoutHandler
  );

  // Fase 30: foto de perfil (qualquer role autenticada)
  fastify.put(
    "/api/auth/me/avatar",
    {
      preHandler: [(fastify as any).authenticate],
    },
    updateAvatarHandler
  );

  // Fase 80: trocar (ou definir, conta só-Google) a senha (qualquer role autenticada)
  fastify.put(
    "/api/auth/me/password",
    {
      preHandler: [(fastify as any).authenticate],
    },
    changePasswordHandler
  );

  // Fase 81 — confirmação de e-mail.
  fastify.post(
    "/api/auth/resend-verification",
    { preHandler: [(fastify as any).authenticate] },
    resendVerificationEmailHandler
  );
  fastify.post("/api/auth/verify-email", verifyEmailHandler);

  // Fase 81 — "esqueci minha senha".
  fastify.post("/api/auth/forgot-password", forgotPasswordHandler);
  fastify.post("/api/auth/reset-password", resetPasswordHandler);

  // Fase 81 — excluir a própria conta (autenticado).
  fastify.delete(
    "/api/auth/me",
    { preHandler: [(fastify as any).authenticate] },
    deleteMyAccountHandler
  );

  // i18n: escolha explícita de idioma (qualquer role autenticada)
  fastify.put(
    "/api/auth/me/locale",
    {
      preHandler: [(fastify as any).authenticate],
    },
    updateLocaleHandler
  );

  // Rota de teste para validar o middleware authenticate
  fastify.get(
    "/api/auth/protected",
    {
      preHandler: [
        (fastify as FastifyInstance & { authenticate: AuthenticateFn })
          .authenticate,
      ],
    },
    protectedHandler
  );
}
