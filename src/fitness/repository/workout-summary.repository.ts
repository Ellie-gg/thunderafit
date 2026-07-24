import prisma from "../../lib/prisma";

export const workoutSummaryRepository = {
  // Séries logadas para ESTE Workout dentro de uma janela de tempo — usado
  // tanto pra janela da sessão que acabou de terminar quanto (com outros
  // argumentos) pra janela da sessão anterior, evitando duplicar a query.
  async findSetLogsForWorkoutInWindow(workoutId: string, start: Date, end: Date) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: { workoutId },
        loggedAt: { gte: start, lte: end },
      },
      include: {
        workoutExercise: { select: { exerciseId: true, exercise: { select: { name: true } } } },
      },
      orderBy: { loggedAt: "asc" },
    });
  },

  // Histórico de TODOS os treinos/programas do aluno pra este exercício,
  // estritamente anterior ao início da janela da sessão atual — não filtra
  // por workoutId (é isso que torna a detecção de PR cross-programa).
  async findHistoricalSetLogsForExercise(alunoId: string, exerciseId: string, before: Date) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: { exerciseId, workout: { alunoId } },
        loggedAt: { lt: before },
      },
      select: { weightKg: true },
    });
  },

  // Mesma busca acima, mas batelada pra VÁRIOS exercícios de uma vez — usada
  // por buildPersonalRecords (detecção de PR ao concluir uma sessão inteira)
  // pra evitar 1 query por exercício da sessão. `workoutExercise.exerciseId`
  // vem junto pra permitir agrupar por exercício em memória depois.
  async findHistoricalSetLogsForExercises(alunoId: string, exerciseIds: string[], before: Date) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: { exerciseId: { in: exerciseIds }, workout: { alunoId } },
        loggedAt: { lt: before },
      },
      select: { weightKg: true, workoutExercise: { select: { exerciseId: true } } },
    });
  },

  // Todas as séries do aluno (qualquer treino/exercício) desde uma data —
  // usado só pra calcular a sequência de dias com atividade (streak), mesma
  // ideia de progressRepository.findSetLogsSince, mas duplicada aqui pra não
  // importar o repositório de outro domínio (progress) dentro de fitness.
  async findSetLogsForAlunoSince(alunoId: string, since: Date) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: { workout: { alunoId } },
        loggedAt: { gte: since },
      },
      select: { loggedAt: true },
    });
  },
};
