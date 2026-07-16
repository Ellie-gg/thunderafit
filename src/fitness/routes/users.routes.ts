import { FastifyInstance } from "fastify";
import { lookupUserHandler } from "../controllers/users.controller";

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/users/lookup",
    {
      preHandler: [(fastify as any).authenticate],
    },
    lookupUserHandler
  );
}
