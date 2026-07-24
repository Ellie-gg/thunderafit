import { FastifyRequest, FastifyReply } from "fastify";
import { exercisesService } from "../services/exercises.service";
import { exercisesRepository } from "../repository/exercises.repository";
import { resolveRequestLocale } from "../../lib/locale";

export async function listExercisesHandler(
  request: FastifyRequest<{ Querystring: { muscleGroup?: string } }>,
  reply: FastifyReply
) {
  try {
    const { muscleGroup } = request.query;
    const locale = resolveRequestLocale(request);
    const exercises = await exercisesService.listExercises(muscleGroup, locale);

    // Catálogo é cache-backed (exercises.repository.ts): a versão só muda
    // quando o cache é de fato repreenchido (TTL expirado ou invalidateCache
    // chamado pelo CRUD do admin). ETag inclui locale/muscleGroup porque o
    // corpo da resposta varia por ambos.
    const version = exercisesRepository.getCacheVersion();
    const etag = `"v${version}-${locale}-${muscleGroup ?? "all"}"`;
    if (request.headers["if-none-match"] === etag) {
      return reply.status(304).send();
    }

    reply.header("ETag", etag);
    // private: rota fica atrás de `authenticate`, não é um cache compartilhado/CDN.
    reply.header("Cache-Control", "private, max-age=60");
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
