import { progressRepository } from "../repository/progress.repository";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM (UTC)
}

/**
 * Granularidade de agregação: por dia (não por sessão/treino individual).
 * Decisão: se o aluno registrar o mesmo exercício em dois treinos no mesmo
 * dia, os dois viram um único ponto no gráfico (o maior peso do dia) — é a
 * granularidade mais legível para um gráfico de evolução ao longo do tempo,
 * e evita ruído de múltiplos pontos no mesmo dia.
 */
export const progressService = {
  async getLoadHistory(alunoId: string, exerciseId: string) {
    const logs = await progressRepository.findSetLogsForExercise(alunoId, exerciseId);

    const maxByDay = new Map<string, number>();
    for (const log of logs) {
      const key = dayKey(log.loggedAt);
      const current = maxByDay.get(key);
      if (current === undefined || log.weightKg > current) {
        maxByDay.set(key, log.weightKg);
      }
    }

    const history = Array.from(maxByDay.entries())
      .map(([date, maxWeightKg]) => ({ date, maxWeightKg }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Variação percentual calculada no backend (não no frontend): evita
    // duplicar a lógica de agregação por dia em dois lugares — o frontend só
    // exibe o número pronto.
    let percentChangeVsPrevious: number | null = null;
    if (history.length >= 2) {
      const last = history[history.length - 1].maxWeightKg;
      const previous = history[history.length - 2].maxWeightKg;
      if (previous > 0) {
        percentChangeVsPrevious = Math.round(((last - previous) / previous) * 10000) / 100;
      }
    }

    return { exerciseId, history, percentChangeVsPrevious };
  },

  async getFrequency(alunoId: string, period: string) {
    const match = /^(\d+)m$/.exec(period);
    const months = match ? Math.min(Math.max(Number(match[1]), 1), 24) : 6;

    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

    const logs = await progressRepository.findSetLogsSince(alunoId, since);

    const workoutIdsByMonth = new Map<string, Set<string>>();
    const allWorkoutIds = new Set<string>();

    for (const log of logs) {
      const key = monthKey(log.loggedAt);
      const workoutId = log.workoutExercise.workoutId;
      allWorkoutIds.add(workoutId);
      if (!workoutIdsByMonth.has(key)) {
        workoutIdsByMonth.set(key, new Set());
      }
      workoutIdsByMonth.get(key)!.add(workoutId);
    }

    // Preenche todos os meses do período, mesmo os sem treino (contagem 0),
    // para o gráfico não "pular" meses vazios.
    const monthsList: { month: string; workoutCount: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1) + i, 1));
      const key = monthKey(d);
      monthsList.push({ month: key, workoutCount: workoutIdsByMonth.get(key)?.size ?? 0 });
    }

    return {
      period: `${months}m`,
      months: monthsList,
      // Contagem de treinos distintos com pelo menos 1 série no período
      // inteiro — não é a soma das colunas mensais, já que (na teoria) um
      // mesmo treino poderia ter séries registradas em meses diferentes.
      totalWorkouts: allWorkoutIds.size,
    };
  },

  async getLoggedExercises(alunoId: string) {
    const workoutExercises = await progressRepository.findLoggedExercisesForAluno(alunoId);
    return workoutExercises.map((we) => ({
      id: we.exercise.id,
      name: we.exercise.name,
      muscleGroup: we.exercise.muscleGroup,
    }));
  },

  /**
   * Fase 33.4: resumo pra barra de voltagem semanal + métricas rápidas do
   * dashboard do aluno.
   *
   * Janela de 90 dias (não só 7) pra calcular a SEQUÊNCIA de verdade — um
   * aluno com 10 dias seguidos de treino não pode ver isso capado em 7 só
   * porque a barra visual só mostra os últimos 7 blocos. O volume, esse sim,
   * é só dos últimos 7 dias (é uma métrica "desta semana", não histórica).
   *
   * Sequência conta pra trás a partir de HOJE, mas se hoje ainda não tem
   * série registrada, começa de ONTEM — não zera a sequência só porque o dia
   * ainda não acabou (mesmo raciocínio de apps de hábito).
   */
  async getWeeklySummary(alunoId: string) {
    const now = new Date();
    const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const logs = await progressRepository.findSetLogsSince(alunoId, since);

    const activeDays = new Set<string>();
    const sevenDaysAgoKey = dayKey(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    let volumeKg = 0;
    for (const log of logs) {
      const key = dayKey(log.loggedAt);
      activeDays.add(key);
      if (key >= sevenDaysAgoKey) {
        volumeKg += log.weightKg * log.repsDone;
      }
    }

    const days: Array<{ date: string; active: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      days.push({ date: key, active: activeDays.has(key) });
    }

    const todayKey = dayKey(now);
    let cursor = activeDays.has(todayKey) ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let streakDays = 0;
    while (activeDays.has(dayKey(cursor))) {
      streakDays++;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    }

    return { days, volumeKg: Math.round(volumeKg * 10) / 10, streakDays };
  },
};
