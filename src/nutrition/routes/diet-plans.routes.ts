import { FastifyInstance } from "fastify";
import {
  listDietPlansHandler,
  createDietPlanHandler,
  addMealHandler,
  addFoodHandler,
  getDietPlanHandler,
} from "../controllers/diet-plans.controller";

export async function dietPlansRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/diet-plans",
    { preHandler: [(fastify as any).authenticate] },
    listDietPlansHandler
  );

  fastify.post(
    "/api/diet-plans",
    { preHandler: [(fastify as any).authenticate] },
    createDietPlanHandler
  );

  fastify.get(
    "/api/diet-plans/:id",
    { preHandler: [(fastify as any).authenticate] },
    getDietPlanHandler
  );

  fastify.post(
    "/api/diet-plans/:id/meals",
    { preHandler: [(fastify as any).authenticate] },
    addMealHandler
  );

  fastify.post(
    "/api/diet-plans/:id/meals/:mealId/foods",
    { preHandler: [(fastify as any).authenticate] },
    addFoodHandler
  );
}
