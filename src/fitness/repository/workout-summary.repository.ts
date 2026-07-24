import { Prisma } from "@prisma/client";
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
  //
  // Perf (triagem 2026-07-24): antes trazia TODAS as linhas históricas (só
  // pra tirar o Math.max em JS) — no caminho mais quente do app (1 chamada
  // por SÉRIE logada), um aluno de longa data podia mover 1000+ linhas do
  // banco pra aplicação só pra descobrir um número. Agregação no Postgres
  // (`aggregate`/`MAX`) devolve só o máximo, sem transferir as linhas.
  async findMaxHistoricalWeightForExercise(
    alunoId: string,
    exerciseId: string,
    before: Date
  ): Promise<number | null> {
    const result = await prisma.setLog.aggregate({
      where: {
        workoutExercise: { exerciseId, workout: { alunoId } },
        loggedAt: { lt: before },
      },
      _max: { weightKg: true },
    });
    return result._max.weightKg;
  },

  // Mesma ideia acima, mas batelada pra VÁRIOS exercícios de uma vez — usada
  // por buildPersonalRecords (detecção de PR ao concluir uma sessão inteira)
  // pra evitar 1 query por exercício da sessão. Prisma `groupBy` não agrupa
  // por campo de relação (o exerciseId mora em WorkoutExercise, não em
  // SetLog), então isto usa `$queryRaw` com GROUP BY via JOIN — `Prisma.join`
  // monta o `IN (...)` de forma parametrizada (sem concatenar string), mesmo
  // cuidado de outras queries cruas do repo (ex: admin.repository.ts).
  async findMaxHistoricalWeightsForExercises(
    alunoId: string,
    exerciseIds: string[],
    before: Date
  ): Promise<Map<string, number>> {
    if (exerciseIds.length === 0) return new Map();
    const rows = await prisma.$queryRaw<Array<{ exerciseId: string; maxWeightKg: number }>>`
      SELECT we."exerciseId" AS "exerciseId", MAX(sl."weightKg") AS "maxWeightKg"
      FROM "SetLog" sl
      JOIN "WorkoutExercise" we ON sl."workoutExerciseId" = we.id
      JOIN "Workout" w ON we."workoutId" = w.id
      WHERE we."exerciseId" IN (${Prisma.join(exerciseIds)})
        AND w."alunoId" = ${alunoId}
        AND sl."loggedAt" < ${before}
      GROUP BY we."exerciseId"
    `;
    return new Map(rows.map((r) => [r.exerciseId, Number(r.maxWeightKg)]));
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
