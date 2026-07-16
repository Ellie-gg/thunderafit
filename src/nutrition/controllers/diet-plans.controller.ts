import { FastifyRequest, FastifyReply } from "fastify";
import { dietPlansService } from "../services/diet-plans.service";

export async function listDietPlansHandler(
  request: FastifyRequest<{ Querystring: { alunoId?: string; nutricionistaId?: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;

  try {
    const plans = await dietPlansService.listPlansForUser(userId, role, {
      alunoId: request.query.alunoId,
      nutricionistaId: request.query.nutricionistaId,
    });
    return reply.status(200).send({ plans });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function createDietPlanHandler(
  request: FastifyRequest<{
    Body: { alunoId: string; name: string };
  }>,
  reply: FastifyReply
) {
  const nutricionistaId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { alunoId, name } = request.body;

  if (role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas Nutricionistas podem criar planos de dieta." });
  }

  try {
    const plan = await dietPlansService.createDietPlan(nutricionistaId, alunoId, name);
    return reply.status(201).send({ plan });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function addMealHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { name: string; time: string; order: number };
  }>,
  reply: FastifyReply
) {
  const nutricionistaId = (request as any).user.sub;
  const { id } = request.params;
  const { name, time, order } = request.body;

  try {
    const meal = await dietPlansService.addMeal(id, nutricionistaId, name, time, order);
    return reply.status(201).send({ meal });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function addFoodHandler(
  request: FastifyRequest<{
    Params: { id: string; mealId: string };
    Body: { foodId: string; quantity: number };
  }>,
  reply: FastifyReply
) {
  const nutricionistaId = (request as any).user.sub;
  const { mealId } = request.params;
  const { foodId, quantity } = request.body;

  try {
    const dietFood = await dietPlansService.addFood(mealId, nutricionistaId, foodId, quantity);
    return reply.status(201).send({ dietFood });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function getDietPlanHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { id } = request.params;

  try {
    const plan = await dietPlansService.getDietPlan(id, userId, role);
    return reply.status(200).send({ plan });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
