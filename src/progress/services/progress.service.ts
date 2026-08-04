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
    // Perf (triagem 2026-07-24): agregação por dia (max de weightKg) agora é
    // feita no Postgres (ver findMaxWeightByDayForExercise) — não busca mais
    // toda a série histórica só para reduzir em JS. `date` é formatado aqui
    // via `.toISOString().slice(0,10)` sobre o `Date` retornado (em vez de
    // confiar em alguma formatação de string vinda do SQL) para garantir
    // exatamente a mesma semântica de dia-UTC que `dayKey()` sempre produziu.
    const rows = await progressRepository.findMaxWeightByDayForExercise(alunoId, exerciseId);

    const history = rows.map((row) => ({
      date: dayKey(row.day),
      maxWeightKg: row.maxWeightKg,
    }));

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
    // Fase 39: a tela inicial do aluno passou a mostrar "séries executadas na
    // semana" no lugar de volume — contagem de SetLog na mesma janela de 7
    // dias já usada pro volume (volumeKg continua no payload, sem uso na UI
    // do dashboard por ora, mas sem motivo pra remover do contrato).
    let setsThisWeek = 0;
    for (const log of logs) {
      const key = dayKey(log.loggedAt);
      activeDays.add(key);
      if (key >= sevenDaysAgoKey) {
        volumeKg += log.weightKg * log.repsDone;
        setsThisWeek++;
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

    return { days, volumeKg: Math.round(volumeKg * 10) / 10, setsThisWeek, streakDays };
  },

  /**
   * Fase 112 (plano de captura de dados pro dashboard histórico) — fundação:
   * `WorkoutSessionLog` (1 linha por conclusão real, ver schema.prisma) no
   * lugar da heurística de janela de 6h que o resumo pós-treino usava antes.
   *
   * `trainingLoad` = RPE × duração em minutos (método de Foster, "carga de
   * treino subjetiva") — substituto sem NENHUM sensor pra "intensidade do
   * treino": só existe quando a sessão tem os dois dados (duração real +
   * RPE respondido), já que RPE é uma pergunta OPCIONAL pós-treino.
   *
   * `effortDistribution` agrupa as sessões com RPE respondido em 3 faixas
   * (leve/moderado/intenso) — distribuição ENTRE sessões, não zona-a-zona
   * DENTRO de 1 sessão (não temos amostragem contínua pra isso — ver plano
   * de dados, seção "crítica de design").
   */
  async getSessionHistory(alunoId: string, limit = 20) {
    const rows = await progressRepository.findRecentSessionLogs(alunoId, limit);

    const sessions = rows
      .slice()
      .reverse() // mais antiga → mais recente, ordem natural de um gráfico de tendência
      .map((r) => {
        const durationMinutes =
          r.durationSeconds !== null ? Math.round((r.durationSeconds / 60) * 10) / 10 : null;
        const trainingLoad =
          r.rpe !== null && durationMinutes !== null ? Math.round(r.rpe * durationMinutes) : null;
        return {
          date: dayKey(r.completedAt),
          durationMinutes,
          volumeKg: Math.round(r.volumeKg * 10) / 10,
          rpe: r.rpe,
          trainingLoad,
        };
      });

    const effortDistribution = { leve: 0, moderado: 0, intenso: 0 };
    for (const r of rows) {
      if (r.rpe === null) continue;
      if (r.rpe <= 3) effortDistribution.leve++;
      else if (r.rpe <= 6) effortDistribution.moderado++;
      else effortDistribution.intenso++;
    }

    return { sessions, effortDistribution };
  },
};
