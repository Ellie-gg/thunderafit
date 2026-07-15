import { FastifyRequest, FastifyReply } from "fastify";
import { workoutsService } from "../services/workouts.service";

export async function listWorkoutsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;

  try {
    const workouts = await workoutsService.listWorkoutsForUser(userId, role);
    return reply.status(200).send({ workouts });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function createWorkoutHandler(
  request: FastifyRequest<{
    Body: { alunoId: string; name: string; letter: string };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const { alunoId, name, letter } = request.body;

  try {
    const workout = await workoutsService.createWorkout(personalId, alunoId, name, letter);
    return reply.status(201).send({ workout });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function addExerciseHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { exerciseId: string; sets: number; repsRange: string; restSeconds: number; order: number };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const { id } = request.params;
  const { exerciseId, sets, repsRange, restSeconds, order } = request.body;

  try {
    const workoutExercise = await workoutsService.addExercise(
      id,
      personalId,
      exerciseId,
      sets,
      repsRange,
      restSeconds,
      order
    );
    return reply.status(201).send({ workoutExercise });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function getWorkoutHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const { id } = request.params;

  try {
    const workout = await workoutsService.getWorkout(id, userId);
    return reply.status(200).send({ workout });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
