import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import authPlugin from "./auth/middlewares/authenticate";
import { authRoutes } from "./auth/routes/auth.routes"; import { relationsRoutes } from "./fitness/routes/relations.routes";
import { exercisesRoutes } from "./fitness/routes/exercises.routes";
import { workoutsRoutes } from "./fitness/routes/workouts.routes";
import { setlogsRoutes } from "./fitness/routes/setlogs.routes";
import { usersRoutes } from "./fitness/routes/users.routes";
import { progressRoutes } from "./progress/routes/progress.routes";
import { billingRoutes } from "./billing/routes/billing.routes";
import { anamnesisRoutes } from "./anamnesis/routes/anamnesis.routes";
import { supportRoutes } from "./support/routes/support.routes";
import { notificationsRoutes } from "./notifications/routes/notifications.routes";
import { foodsRoutes } from "./nutrition/routes/foods.routes";
import { dietPlansRoutes } from "./nutrition/routes/diet-plans.routes";
import { adminRoutes } from "./admin/routes/admin.routes";

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== "test",
    // Necessário para o rate limiting de login (Fase 14) enxergar o IP real
    // do usuário: em produção o backend só recebe tráfego do proxy do
    // próprio frontend (Cloud Run com invocação restrita por IAM), então
    // `request.ip` sem isso seria sempre o IP interno do frontend, não o do
    // cliente final. O Cloud Run já injeta X-Forwarded-For em cada hop, e o
    // proxy do frontend repassa os headers da requisição original sem
    // alterá-los — `trustProxy` faz o Fastify usar o IP mais à esquerda
    // dessa cadeia (o real).
    trustProxy: true,
  });

  // CORS: em produção, frontend e backend provavelmente estarão em domínios
  // diferentes de verdade (o rewrite do Next.js só resolve isso em dev/mesmo
  // host). ALLOWED_ORIGIN é configurável via env, sem default hardcoded de
  // produção; em dev, cai no localhost do frontend.
  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  });

  // Cookies httpOnly (Fase 5.5) — necessário para setCookie/clearCookie e
  // para o middleware `authenticate` ler o access token do cookie.
  await fastify.register(cookie);

  // Registrar o plugin de autenticação (disponibiliza fastify.authenticate)
  await fastify.register(authPlugin);

  // Registrar rotas de autenticação
  await fastify.register(authRoutes); await fastify.register(relationsRoutes);
  await fastify.register(exercisesRoutes);
  await fastify.register(workoutsRoutes);
  await fastify.register(setlogsRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(progressRoutes);
  await fastify.register(billingRoutes);
  await fastify.register(anamnesisRoutes);
  await fastify.register(supportRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(foodsRoutes);
  await fastify.register(dietPlansRoutes);
  await fastify.register(adminRoutes);

  // Health check
  fastify.get("/health", async (_request, reply) => {
    return reply.status(200).send({ status: "ok", timestamp: new Date().toISOString() });
  });

  return fastify;
}
