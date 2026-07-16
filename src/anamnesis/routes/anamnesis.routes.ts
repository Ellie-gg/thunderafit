import { FastifyInstance } from "fastify";
import {
  getAnamnesisHandler,
  createAnamnesisHandler,
  updateAnamnesisHandler,
} from "../controllers/anamnesis.controller";

export async function anamnesisRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [(fastify as any).authenticate] };

  fastify.get("/api/anamnesis", auth, getAnamnesisHandler);
  fastify.post("/api/anamnesis", auth, createAnamnesisHandler);
  fastify.put("/api/anamnesis", auth, updateAnamnesisHandler);
}
