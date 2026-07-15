import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  protectedHandler,
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
