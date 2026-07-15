import { FastifyRequest, FastifyReply } from "fastify";
import { setlogsService } from "../services/setlogs.service";

export async function createSetLogHandler(
  request: FastifyRequest<{
    Params: { workoutId: string; workoutExerciseId: string };
    Body: { setNumber: number; repsDone: number; weightKg: number };
  }>,
  reply: FastifyReply
) {
  const alunoId = (request as any).user.sub;
  const { workoutId, workoutExerciseId } = request.params;
  const { setNumber, repsDone, weightKg } = request.body;

  try {
    const setLog = await setlogsService.createSetLog(
      workoutId,
      workoutExerciseId,
      alunoId,
      setNumber,
      repsDone,
      weightKg
    );
    return reply.status(201).send({ setLog });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function listSetLogsHandler(
  request: FastifyRequest<{
    Params: { workoutId: string; workoutExerciseId: string };
  }>,
  reply: FastifyReply
) {
  const alunoId = (request as any).user.sub;
  const { workoutId, workoutExerciseId } = request.params;

  try {
    const setLogs = await setlogsService.listSetLogs(workoutId, workoutExerciseId, alunoId);
    return reply.status(200).send({ setLogs });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
