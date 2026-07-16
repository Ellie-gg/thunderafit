import {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginAsync,
} from "fastify";
import fp from "fastify-plugin";
import { verifyAccessToken, JwtPayload } from "../services/auth.service";

/**
 * Plugin Fastify que adiciona o decorator `authenticate` à instância.
 * Uso em rotas protegidas:
 *
 *   fastify.get('/protected', { preHandler: fastify.authenticate }, handler)
 *
 * Ou via preValidation global.
 */
const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      const cookieToken = (request as FastifyRequest & { cookies: Record<string, string | undefined> })
        .cookies?.access_token;

      // Cookie tem prioridade sobre o header Authorization: em produção, o
      // proxy do frontend (Cloud Run com invocação restrita por IAM) injeta
      // seu próprio `Authorization: Bearer <ID token do Google>` em TODA
      // requisição — se o header tivesse prioridade, esse ID token seria
      // validado como se fosse o JWT da aplicação e sempre falharia (bug real
      // encontrado ao popular o banco de produção: toda rota protegida
      // retornava 401, mesmo com o cookie de sessão presente e válido).
      // Bearer via header continua funcionando para clients sem cookie
      // (curl/Postman/dev local direto no backend).
      const token = cookieToken ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

      if (!token) {
        return reply.status(401).send({ error: "Token de acesso não fornecido." });
      }

      try {
        const payload: JwtPayload = verifyAccessToken(token);
        // Popula request.user para uso nos handlers downstream
        (request as FastifyRequest & { user: JwtPayload }).user = payload;
      } catch {
        return reply.status(401).send({ error: "Token de acesso inválido ou expirado." });
      }
    }
  );
};

// Exportar como fastify-plugin para que o decorator seja acessível em toda a instância
export default fp(authPlugin, { name: "authenticate" });
