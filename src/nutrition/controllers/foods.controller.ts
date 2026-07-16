import { FastifyRequest, FastifyReply } from "fastify";
import { foodsService } from "../services/foods.service";

export async function listFoodsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const foods = await foodsService.listFoods();
    return reply.status(200).send({ foods });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
