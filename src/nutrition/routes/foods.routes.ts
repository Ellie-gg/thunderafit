import { FastifyInstance } from "fastify";
import { listFoodsHandler } from "../controllers/foods.controller";

export async function foodsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/foods",
    {
      preHandler: [(fastify as any).authenticate],
    },
    listFoodsHandler
  );
}
