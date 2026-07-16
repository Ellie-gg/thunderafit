import { FastifyRequest, FastifyReply } from "fastify";
import { exercisesService } from "../services/exercises.service";

export async function listExercisesHandler(
  request: FastifyRequest<{ Querystring: { muscleGroup?: string } }>,
  reply: FastifyReply
) {
  try {
    const { muscleGroup } = request.query;
    const exercises = await exercisesService.listExercises(muscleGroup);
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
