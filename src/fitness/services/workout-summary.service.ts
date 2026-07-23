import { workoutSummaryRepository } from "../repository/workout-summary.repository";

// Janela de segurança pra "esta sessão": não existe uma entidade de sessão/
// conclusão no banco (Workout.lastCompletedAt é um único timestamp que se
// sobrescreve a cada conclusão), então inferimos quais SetLog pertencem à
// sessão que acabou de terminar por tempo — tudo logado depois da conclusão
// anterior, com este teto pra não puxar séries de dias muito antigos caso o
// aluno tenha ficado com sets pendentes sem concluir por muito tempo.
const SESSION_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h

// Janela pra cálculo de sequência (streak) — generosa (não só os últimos 7
// dias) pra um aluno com 10+ dias seguidos não ver a sequência capada.
// Mesmo raciocínio já usado em progress.service.ts::getWeeklySummary.
const STREAK_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

// Fase 39: a duração da sessão SAIU deste summary — antes era aproximada
// (primeira a última série logada), o que subestimava o aquecimento antes
// da 1ª série. Substituída por um cronômetro real no frontend (marca o
// timestamp de quando a tela de execução abre até o clique em "Concluir"),
// sem precisar de nenhum campo novo no banco nem lógica aqui.

interface WorkoutForSummary {
  id: string;
  alunoId: string | null;
  name: string;
  letter: string;
}

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
  hasHistory: boolean;
  previousVolumeKg: number | null;
  volumeChangePercent: number | null;
  streakDays: number;
  personalRecords: WorkoutSummaryPR[];
}

function sumVolumeKg(logs: Array<{ weightKg: number; repsDone: number }>): number {
  return logs.reduce((total, log) => total + log.weightKg * log.repsDone, 0);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Mesma lógica de streak de progress.service.ts::getWeeklySummary (contagem
// pra trás a partir de hoje; começa de ontem se hoje ainda não tem série —
// não zera a sequência só porque o dia ainda não acabou).
function computeStreakDays(loggedAtDates: Date[], now: Date): number {
  const activeDays = new Set(loggedAtDates.map(dayKey));
  const todayKey = dayKey(now);
  let cursor = activeDays.has(todayKey) ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let streakDays = 0;
  while (activeDays.has(dayKey(cursor))) {
    streakDays++;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streakDays;
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

    const { hasHistory, previousVolumeKg, volumeChangePercent } = await buildVolumeComparison(
      workout.id,
      previousLastCompletedAt,
      volumeKg
    );
    const personalRecords = await buildPersonalRecords(workout.alunoId, thisSessionLogs, windowStart);
    const streakDays = workout.alunoId ? await buildStreakDays(workout.alunoId, completedAt) : 0;

    return {
      workoutId: workout.id,
      workoutName: workout.name,
      workoutLetter: workout.letter,
      completedAt: completedAt.toISOString(),
      volumeKg: Math.round(volumeKg * 10) / 10,
      setsLogged,
      hasHistory,
      previousVolumeKg,
      volumeChangePercent,
      streakDays,
      personalRecords,
    };
  },

  // Detecção de PR em tempo real, usada por setlogs.service ao gravar uma
  // série — compara só contra o histórico ANTERIOR (não inclui a série que
  // acabou de ser criada). PR = maior peso já registrado, reps não entram na
  // comparação. Primeira vez que o aluno registra o exercício → não é PR
  // (sem baseline pra bater).
  async detectPersonalRecord(
    alunoId: string,
    exerciseId: string,
    weightKg: number,
    before: Date
  ): Promise<{ isPersonalRecord: boolean; previousBest: number | null }> {
    const historicalLogs = await workoutSummaryRepository.findHistoricalSetLogsForExercise(
      alunoId,
      exerciseId,
      before
    );
    if (historicalLogs.length === 0) {
      return { isPersonalRecord: false, previousBest: null };
    }
    const previousBest = Math.max(...historicalLogs.map((l) => l.weightKg));
    return { isPersonalRecord: weightKg > previousBest, previousBest };
  },
};

async function buildVolumeComparison(
  workoutId: string,
  previousLastCompletedAt: Date | null,
  thisVolumeKg: number
): Promise<{ hasHistory: boolean; previousVolumeKg: number | null; volumeChangePercent: number | null }> {
  if (!previousLastCompletedAt) {
    return { hasHistory: false, previousVolumeKg: null, volumeChangePercent: null };
  }

  const prevWindowStart = new Date(previousLastCompletedAt.getTime() - SESSION_WINDOW_MS);
  const prevLogs = await workoutSummaryRepository.findSetLogsForWorkoutInWindow(
    workoutId,
    prevWindowStart,
    previousLastCompletedAt
  );
  const previousVolumeKg = sumVolumeKg(prevLogs);

  if (previousVolumeKg <= 0) {
    return { hasHistory: false, previousVolumeKg: 0, volumeChangePercent: null };
  }

  const roundedPrevious = Math.round(previousVolumeKg * 10) / 10;
  const volumeChangePercent = Math.round(((thisVolumeKg - previousVolumeKg) / previousVolumeKg) * 10000) / 100;
  return { hasHistory: true, previousVolumeKg: roundedPrevious, volumeChangePercent };
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

async function buildStreakDays(alunoId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - STREAK_LOOKBACK_MS);
  const logs = await workoutSummaryRepository.findSetLogsForAlunoSince(alunoId, since);
  return computeStreakDays(
    logs.map((l) => l.loggedAt),
    now
  );
}
