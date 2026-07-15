import { FastifyRequest, FastifyReply } from "fastify";
import { exercisesService } from "../services/exercises.service";

export async function listExercisesHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const exercises = await exercisesService.listExercises();
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
