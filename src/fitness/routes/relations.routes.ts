import { FastifyInstance } from "fastify";
import {
  createRelationHandler,
  listRelationsHandler,
  setPaymentReminderHandler,
} from "../controllers/relations.controller";

export async function relationsRoutes(fastify: FastifyInstance) {
  // POST /api/relations - create a new relationship
  fastify.post(
    "/api/relations",
    {
      preHandler: [
        (fastify as any).authenticate,
      ],
    },
    createRelationHandler
  );

  // GET /api/relations - list relationships for authenticated personal
  fastify.get(
    "/api/relations",
    {
      preHandler: [
        (fastify as any).authenticate,
      ],
    },
    listRelationsHandler
  );

  // PUT /api/relations/:alunoId/payment-reminder - Personal configura/desativa o lembrete
  fastify.put(
    "/api/relations/:alunoId/payment-reminder",
    {
      preHandler: [
        (fastify as any).authenticate,
      ],
    },
    setPaymentReminderHandler
  );
}
