import { setlogsRepository } from "../repository/setlogs.repository";
import { workoutsRepository } from "../repository/workouts.repository";

async function assertOwnerAluno(
  workoutId: string,
  workoutExerciseId: string,
  alunoId: string,
  role?: string
) {
  const workout = await workoutsRepository.findById(workoutId);
  if (!workout) {
    const err = new Error("Treino não encontrado.");
    (err as any).statusCode = 404;
    throw err;
  }

  if (role !== "ADMIN" && workout.alunoId !== alunoId) {
    const err = new Error("Você não tem permissão para acessar este treino.");
    (err as any).statusCode = 403;
    throw err;
  }

  const workoutExercise = await setlogsRepository.findWorkoutExerciseById(workoutExerciseId);
  if (!workoutExercise || workoutExercise.workoutId !== workoutId) {
    const err = new Error("Exercício não pertence ao treino informado.");
    (err as any).statusCode = 400;
    throw err;
  }

  return workoutExercise;
}

export const setlogsService = {
  async createSetLog(
    workoutId: string,
    workoutExerciseId: string,
    alunoId: string,
    setNumber: number,
    repsDone: number,
    weightKg: number
  ) {
    await assertOwnerAluno(workoutId, workoutExerciseId, alunoId);
    return setlogsRepository.create(workoutExerciseId, setNumber, repsDone, weightKg);
  },

  async listSetLogs(workoutId: string, workoutExerciseId: string, alunoId: string, role?: string) {
    await assertOwnerAluno(workoutId, workoutExerciseId, alunoId, role);
    return setlogsRepository.findAllByWorkoutExercise(workoutExerciseId);
  },
};
