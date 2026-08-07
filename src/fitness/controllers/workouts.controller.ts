import { FastifyRequest, FastifyReply } from "fastify";
import { workoutsService } from "../services/workouts.service";
import {
  workoutGeneratorService,
  WorkoutGoal,
  ExperienceLevel,
} from "../services/workout-generator.service";
import { resolveRequestLocale } from "../../lib/locale";
import { parsePaginationQuery } from "../../lib/pagination";

export async function listWorkoutsHandler(
  request: FastifyRequest<{
    Querystring: { alunoId?: string; personalId?: string; page?: string; pageSize?: string };
  }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;

  try {
    const workouts = await workoutsService.listWorkoutsForUser(
      userId,
      role,
      {
        alunoId: request.query.alunoId,
        personalId: request.query.personalId,
      },
      parsePaginationQuery(request.query)
    );
    return reply.status(200).send({ workouts });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    // F3 (auditoria 2026-07-31): propaga `code` (ex: PERSONAL_PLAN_RESTRICTED,
    // PERSONAL_OVER_LIMIT) — antes só os 402 de Premium abaixo faziam isso.
    return reply.status(status).send({ error: err.message, code: err.code });
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
    // F3 (auditoria 2026-07-31): propaga `code` (ex: PERSONAL_PLAN_RESTRICTED,
    // PERSONAL_OVER_LIMIT) — antes só os 402 de Premium abaixo faziam isso.
    return reply.status(status).send({ error: err.message, code: err.code });
  }
}

/**
 * "Montagem Inteligente" — motor de regras determinístico, sem LLM externa.
 * NÃO persiste nada (nenhum WorkoutProgram/Workout/WorkoutExercise é criado
 * aqui): devolve só um rascunho pro Personal revisar/editar antes de mandar
 * criar de verdade via os endpoints já existentes (POST /api/workout-programs
 * → POST /api/workout-programs/:id/sessions → POST /api/workouts/:id/exercises
 * em sequência, do lado do frontend).
 */
export async function generateWorkoutHandler(
  request: FastifyRequest<{
    Body: { muscleGroups: string[]; goal: WorkoutGoal; level?: ExperienceLevel };
  }>,
  reply: FastifyReply
) {
  const role = (request as any).user.role;
  if (role !== "PERSONAL") {
    return reply
      .status(403)
      .send({ error: "Apenas Personal Trainers podem gerar sugestões de treino." });
  }

  try {
    const exercises = await workoutGeneratorService.generateDraft(
      request.body.muscleGroups,
      request.body.goal,
      request.body.level ?? "intermediario"
    );
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    const status = err.statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

// Fase 85: os 3 handlers abaixo agora ramificam por role — ALUNO chama os
// métodos NOVOS (`addSelfExercise`/`moveSelfExercise`/`deleteSelfExercise`,
// que checam origin SELF + Premium); qualquer outro role continua chamando
// exatamente os mesmos métodos de sempre, sem nenhuma mudança de
// comportamento (o treino PRESCRITO pelo Personal não muda em nada).
function errStatus(err: any): number {
  return err.statusCode ?? 500;
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
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { id } = request.params;
  const { exerciseId, sets, repsRange, restSeconds, order, notes } = request.body;

  try {
    const workoutExercise =
      role === "ALUNO"
        ? await workoutsService.addSelfExercise(id, userId, exerciseId, sets, repsRange, restSeconds, order, notes)
        : await workoutsService.addExercise(id, userId, exerciseId, sets, repsRange, restSeconds, order, notes);
    return reply.status(201).send({ workoutExercise });
  } catch (err: any) {
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return reply.status(errStatus(err)).send({ error: err.message, code: err.code });
  }
}

export async function moveExerciseHandler(
  request: FastifyRequest<{
    Params: { id: string; exerciseId: string };
    Body: { direction: "up" | "down" };
  }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { id, exerciseId } = request.params;
  const { direction } = request.body;

  if (direction !== "up" && direction !== "down") {
    return reply.status(400).send({ error: "direction deve ser 'up' ou 'down'." });
  }

  try {
    const exercises =
      role === "ALUNO"
        ? await workoutsService.moveSelfExercise(id, userId, exerciseId, direction)
        : await workoutsService.moveExercise(id, userId, exerciseId, direction);
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return reply.status(errStatus(err)).send({ error: err.message, code: err.code });
  }
}

export async function deleteExerciseHandler(
  request: FastifyRequest<{ Params: { id: string; exerciseId: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { id, exerciseId } = request.params;

  try {
    const exercises =
      role === "ALUNO"
        ? await workoutsService.deleteSelfExercise(id, userId, exerciseId)
        : await workoutsService.deleteExercise(id, userId, exerciseId);
    return reply.status(200).send({ exercises });
  } catch (err: any) {
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return reply.status(errStatus(err)).send({ error: err.message, code: err.code });
  }
}

export async function renameWorkoutHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { name: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { id } = request.params;
  // B3 (auditoria 2026-08-06): `?.` porque um PATCH sem corpo (ou sem
  // `content-type: application/json`) deixa `request.body` undefined —
  // desestruturar direto virava TypeError FORA do try, respondendo 500 com
  // "Cannot destructure property" em vez do 400 do domínio. Mesmo cuidado que
  // `completeWorkoutHandler` já tomava.
  const { name } = request.body ?? {};

  try {
    const workout =
      role === "ALUNO"
        ? await workoutsService.renameSelfWorkout(id, userId, name)
        : await workoutsService.renameWorkout(id, userId, name);
    return reply.status(200).send({ workout });
  } catch (err: any) {
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return reply.status(errStatus(err)).send({ error: err.message, code: err.code });
  }
}

/**
 * Fase 120: excluir a SESSÃO inteira do programa. Ramifica por role no
 * controller, mesmo padrão de `renameWorkoutHandler` acima e de
 * `deleteProgramHandler` (desde a Fase 85) — o ALUNO só mexe no próprio treino
 * `origin: SELF` (com gate de Premium), o PERSONAL no que é dele.
 */
export async function deleteWorkoutHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const role = (request as any).user.role;
  const { id } = request.params;

  try {
    const result =
      role === "ALUNO"
        ? await workoutsService.deleteSelfWorkout(id, userId)
        : await workoutsService.deleteWorkout(id, userId);
    return reply.status(200).send(result);
  } catch (err: any) {
    if (err.code === "PREMIUM_REQUIRED") {
      return reply.status(402).send({ error: err.message, code: err.code });
    }
    return reply.status(errStatus(err)).send({ error: err.message, code: err.code });
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
    const workout = await workoutsService.getWorkout(id, userId, role, resolveRequestLocale(request));
    return reply.status(200).send({ workout });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    // F3 (auditoria 2026-07-31): propaga `code` (ex: PERSONAL_PLAN_RESTRICTED,
    // PERSONAL_OVER_LIMIT) — antes só os 402 de Premium abaixo faziam isso.
    return reply.status(status).send({ error: err.message, code: err.code });
  }
}

export async function completeWorkoutHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { durationSeconds?: number } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const { id } = request.params;
  // Fase 112: opcional — corpo vazio (client mais antigo) continua
  // funcionando exatamente como antes, só sem duração real persistida.
  const durationSeconds = request.body?.durationSeconds;

  try {
    const { workout, summary } = await workoutsService.completeWorkout(id, userId, durationSeconds);
    return reply.status(200).send({ workout, summary });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    // F3 (auditoria 2026-07-31): propaga `code` (ex: PERSONAL_PLAN_RESTRICTED,
    // PERSONAL_OVER_LIMIT) — antes só os 402 de Premium abaixo faziam isso.
    return reply.status(status).send({ error: err.message, code: err.code });
  }
}

// Fase 112: preenchimento opcional do RPE, num passo SEPARADO depois do
// resumo pós-treino — nunca bloqueia `completeWorkoutHandler` acima.
export async function setSessionRpeHandler(
  request: FastifyRequest<{ Params: { sessionLogId: string }; Body: { rpe: number } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const { sessionLogId } = request.params;
  // B3 (auditoria 2026-08-06): ver o comentário no handler de rename acima.
  const { rpe } = request.body ?? {};

  try {
    const sessionLog = await workoutsService.setSessionRpe(sessionLogId, userId, rpe);
    return reply.status(200).send({ sessionLog });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
