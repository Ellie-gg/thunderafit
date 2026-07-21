import { workoutSummaryRepository } from "../repository/workout-summary.repository";

// Janela de segurança pra "esta sessão": não existe uma entidade de sessão/
// conclusão no banco (Workout.lastCompletedAt é um único timestamp que se
// sobrescreve a cada conclusão), então inferimos quais SetLog pertencem à
// sessão que acabou de terminar por tempo — tudo logado depois da conclusão
// anterior, com este teto pra não puxar séries de dias muito antigos caso o
// aluno tenha ficado com sets pendentes sem concluir por muito tempo.
const SESSION_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h

interface WorkoutForSummary {
  id: string;
  alunoId: string | null;
  name: string;
  letter: string;
}

export type WorkoutSummaryComparison =
  | { type: "FIRST_TIME"; previousVolumeKg: number | null; percentChange: null }
  | { type: "PERCENT"; previousVolumeKg: number; percentChange: number };

export interface WorkoutSummaryPR {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  previousBestKg: number;
}

export interface WorkoutCompletionSummary {
  workoutId: string;
  workoutName: string;
  workoutLetter: string;
  completedAt: string;
  volumeKg: number;
  setsLogged: number;
  comparison: WorkoutSummaryComparison;
  personalRecords: WorkoutSummaryPR[];
}

function sumVolumeKg(logs: Array<{ weightKg: number; repsDone: number }>): number {
  return logs.reduce((total, log) => total + log.weightKg * log.repsDone, 0);
}

export const workoutSummaryService = {
  async buildCompletionSummary(
    workout: WorkoutForSummary,
    previousLastCompletedAt: Date | null,
    completedAt: Date
  ): Promise<WorkoutCompletionSummary> {
    const windowStart = previousLastCompletedAt
      ? new Date(Math.max(previousLastCompletedAt.getTime(), completedAt.getTime() - SESSION_WINDOW_MS))
      : new Date(completedAt.getTime() - SESSION_WINDOW_MS);

    const thisSessionLogs = await workoutSummaryRepository.findSetLogsForWorkoutInWindow(
      workout.id,
      windowStart,
      completedAt
    );

    const volumeKg = sumVolumeKg(thisSessionLogs);
    const setsLogged = thisSessionLogs.length;

    const comparison = await buildComparison(workout.id, previousLastCompletedAt, volumeKg);
    const personalRecords = await buildPersonalRecords(workout.alunoId, thisSessionLogs, windowStart);

    return {
      workoutId: workout.id,
      workoutName: workout.name,
      workoutLetter: workout.letter,
      completedAt: completedAt.toISOString(),
      volumeKg: Math.round(volumeKg * 10) / 10,
      setsLogged,
      comparison,
      personalRecords,
    };
  },
};

async function buildComparison(
  workoutId: string,
  previousLastCompletedAt: Date | null,
  thisVolumeKg: number
): Promise<WorkoutSummaryComparison> {
  if (!previousLastCompletedAt) {
    return { type: "FIRST_TIME", previousVolumeKg: null, percentChange: null };
  }

  const prevWindowStart = new Date(previousLastCompletedAt.getTime() - SESSION_WINDOW_MS);
  const prevLogs = await workoutSummaryRepository.findSetLogsForWorkoutInWindow(
    workoutId,
    prevWindowStart,
    previousLastCompletedAt
  );
  const previousVolumeKg = sumVolumeKg(prevLogs);

  if (previousVolumeKg <= 0) {
    return { type: "FIRST_TIME", previousVolumeKg: 0, percentChange: null };
  }

  const roundedPrevious = Math.round(previousVolumeKg * 10) / 10;
  const percentChange = Math.round(((thisVolumeKg - previousVolumeKg) / previousVolumeKg) * 10000) / 100;
  return { type: "PERCENT", previousVolumeKg: roundedPrevious, percentChange };
}

async function buildPersonalRecords(
  alunoId: string | null,
  thisSessionLogs: Array<{ weightKg: number; workoutExercise: { exerciseId: string; exercise: { name: string } } }>,
  windowStart: Date
): Promise<WorkoutSummaryPR[]> {
  if (!alunoId) return [];

  const maxByExercise = new Map<string, { exerciseName: string; weightKg: number }>();
  for (const log of thisSessionLogs) {
    const exerciseId = log.workoutExercise.exerciseId;
    const current = maxByExercise.get(exerciseId);
    if (!current || log.weightKg > current.weightKg) {
      maxByExercise.set(exerciseId, {
        exerciseName: log.workoutExercise.exercise.name,
        weightKg: log.weightKg,
      });
    }
  }

  const personalRecords: WorkoutSummaryPR[] = [];
  for (const [exerciseId, { exerciseName, weightKg }] of maxByExercise) {
    const historicalLogs = await workoutSummaryRepository.findHistoricalSetLogsForExercise(
      alunoId,
      exerciseId,
      windowStart
    );
    if (historicalLogs.length === 0) {
      // Sem nenhum histórico anterior pra este exercício — não conta como PR
      // (evita gerar selo de "recorde" toda vez que o Personal adiciona um
      // exercício novo ao programa; recorde implica bater uma tentativa
      // anterior de verdade).
      continue;
    }
    const previousBestKg = Math.max(...historicalLogs.map((l) => l.weightKg));
    if (weightKg > previousBestKg) {
      personalRecords.push({ exerciseId, exerciseName, weightKg, previousBestKg });
    }
  }

  personalRecords.sort((a, b) => b.weightKg - a.weightKg);
  return personalRecords;
}
