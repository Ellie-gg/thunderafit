import { setlogsRepository } from "../repository/setlogs.repository";
import { workoutsRepository } from "../repository/workouts.repository";
import { workoutSummaryService } from "./workout-summary.service";
import { assertAlunoWorkoutAccessible } from "../../lib/plan-expiry";

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
  // Fase 103: registrar/ver séries é acesso do aluno ao treino — mesmo gate
  // de workouts.service.ts#getWorkout. Admin (papel exigido acima pra ler
  // sem ser o próprio dono) não é bloqueado, mesma exceção já feita ali.
  if (role !== "ADMIN") {
    await assertAlunoWorkoutAccessible(workout.personalId, alunoId);
  }

  const workoutExercise = await setlogsRepository.findWorkoutExerciseById(workoutExerciseId);
  if (!workoutExercise || workoutExercise.workoutId !== workoutId) {
    const err = new Error("Exercício não pertence ao treino informado.");
    (err as any).statusCode = 400;
    throw err;
  }

  return workoutExercise;
}

// F4 (auditoria 2026-07-31): nada validava esses 3 números — negativos
// passavam direto pro Prisma. Pior caso concreto: peso E reps negativos se
// cancelam na multiplicação (`sumVolumeKg`), produzindo um volume POSITIVO
// espúrio no resumo pós-treino e contaminando a comparação de PR.
function assertValidSetLog(setNumber: number, repsDone: number, weightKg: number) {
  const err = (message: string) => {
    const e = new Error(message) as Error & { statusCode: number };
    e.statusCode = 400;
    return e;
  };
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    throw err("setNumber deve ser um número inteiro maior ou igual a 1.");
  }
  if (!Number.isInteger(repsDone) || repsDone < 0) {
    throw err("repsDone deve ser um número inteiro maior ou igual a 0.");
  }
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg < 0) {
    throw err("weightKg deve ser um número maior ou igual a 0.");
  }
}

export const setlogsService = {
  // Fase 36: detecção de PR em tempo real — comparada ANTES de gravar a nova
  // série (senão a própria série que acabou de ser salva "bateria a si
  // mesma" no histórico). PR = maior peso já registrado pro exercício por
  // este aluno, reps não entram na comparação; primeira vez que o aluno
  // registra o exercício não conta como PR (sem baseline pra bater).
  async createSetLog(
    workoutId: string,
    workoutExerciseId: string,
    alunoId: string,
    setNumber: number,
    repsDone: number,
    weightKg: number
  ) {
    assertValidSetLog(setNumber, repsDone, weightKg);
    const workoutExercise = await assertOwnerAluno(workoutId, workoutExerciseId, alunoId);

    const { isPersonalRecord, previousBest } = await workoutSummaryService.detectPersonalRecord(
      alunoId,
      workoutExercise.exerciseId,
      weightKg
    );

    const setLog = await setlogsRepository.create(workoutExerciseId, setNumber, repsDone, weightKg);
    return { setLog, isPersonalRecord, previousBest };
  },

  async listSetLogs(workoutId: string, workoutExerciseId: string, alunoId: string, role?: string) {
    await assertOwnerAluno(workoutId, workoutExerciseId, alunoId, role);
    return setlogsRepository.findAllByWorkoutExercise(workoutExerciseId);
  },
};
