import { FastifyRequest, FastifyReply } from "fastify";
import { workoutsService } from "../services/workouts.service";

export async function listWorkoutsHandler(
  request: FastifyRequest<{ Querystring: { alunoId?: string; personalId?: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;

  try {
    const workouts = await workoutsService.listWorkoutsForUser(userId, role, {
      alunoId: request.query.alunoId,
      personalId: request.query.personalId,
    });
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
  const role = (request as any).user.role;
  const { alunoId, name, letter } = request.body;

  // Fase 17 (Item 4 — auditoria): treino é domínio do Personal. Antes não
  // havia checagem de role aqui (só de vínculo), então um Nutricionista
  // vinculado ao aluno conseguia criar treino — incoerente com diet-plans,
  // que já restringe a NUTRICIONISTA. Fechado para PERSONAL.
  if (role !== "PERSONAL") {
    return reply.status(403).send({ error: "Apenas Personal Trainers podem criar treinos." });
  }

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
    Body: {
      exerciseId: string;
      sets: number;
      repsRange: string;
      restSeconds: number;
      order: number;
      notes?: string;
    };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const { id } = request.params;
  const { exerciseId, sets, repsRange, restSeconds, order, notes } = request.body;

  try {
    const workoutExercise = await workoutsService.addExercise(
      id,
      personalId,
      exerciseId,
      sets,
      repsRange,
      restSeconds,
      order,
      notes
    );
    return reply.status(201).send({ workoutExercise });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function moveExerciseHandler(
  request: FastifyRequest<{
    Params: { id: string; exerciseId: string };
    Body: { direction: "up" | "down" };
  }>,
  reply: FastifyReply
) {
  const personalId = (request as any).user.sub;
  const { id, exerciseId } = request.params;
  const { direction } = request.body;

  if (direction !== "up" && direction !== "down") {
    return reply.status(400).send({ error: "direction deve ser 'up' ou 'down'." });
  }

  try {
    const exercises = await workoutsService.moveExercise(id, personalId, exerciseId, direction);
    return reply.status(200).send({ exercises });
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
  const role = (request as any).user.role;
  const { id } = request.params;

  try {
    const workout = await workoutsService.getWorkout(id, userId, role);
    return reply.status(200).send({ workout });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function completeWorkoutHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const { id } = request.params;

  try {
    const workout = await workoutsService.completeWorkout(id, userId);
    return reply.status(200).send({ workout });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
