import prisma from "../../lib/prisma";

export const progressRepository = {
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
