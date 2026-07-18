import prisma from "../../lib/prisma";

export const progressRepository = {
  /**
   * Consulta ClientRelation direto via Prisma (mesmo padrão do módulo
   * anamnesis) — evita importar o repository de outro domínio (`/src/fitness`),
   * mantendo os domínios desacoplados.
   *
   * Bugs potenciais considerados antes de escrever esta função:
   * - usar `findFirst` em vez da chave composta esconderia duplicatas —
   *   `@@unique([personalId, alunoId])` no schema já garante no máximo 1 linha,
   *   então `findUnique` é seguro e mais explícito sobre essa garantia.
   * - o campo se chama `personalId` mesmo para vínculo de NUTRICIONISTA (é o
   *   nome genérico usado desde a Fase 11) — não renomear o parâmetro aqui
   *   pra não divergir do restante do schema/domínio.
   * - validação de presença (alunoId/personalId vazios) fica no controller,
   *   não aqui — mesmo padrão do anamnesisRepository.findRelation.
   */
  async findRelation(personalId: string, alunoId: string) {
    return prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
  },

  async findSetLogsForExercise(alunoId: string, exerciseId: string) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: {
          exerciseId,
          workout: { alunoId },
        },
      },
      orderBy: { loggedAt: "asc" },
    });
  },

  async findSetLogsSince(alunoId: string, since: Date) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: { workout: { alunoId } },
        loggedAt: { gte: since },
      },
      include: {
        workoutExercise: { select: { workoutId: true } },
      },
      orderBy: { loggedAt: "asc" },
    });
  },

  async findLoggedExercisesForAluno(alunoId: string) {
    return prisma.workoutExercise.findMany({
      where: {
        workout: { alunoId },
        setLogs: { some: {} },
      },
      include: { exercise: true },
      distinct: ["exerciseId"],
    });
  },
};
