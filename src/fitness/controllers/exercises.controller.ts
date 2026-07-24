import { FastifyRequest, FastifyReply } from "fastify";
import { exercisesService } from "../services/exercises.service";
import { resolveRequestLocale } from "../../lib/locale";

export async function listExercisesHandler(
  request: FastifyRequest<{ Querystring: { muscleGroup?: string } }>,
  reply: FastifyReply
) {
  try {
    const { muscleGroup } = request.query;
    const exercises = await exercisesService.listExercises(muscleGroup, resolveRequestLocale(request));
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
