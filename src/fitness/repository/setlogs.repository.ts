import prisma from "../../lib/prisma";

// Mesmo teto e mesma razão de workouts.repository.ts / workout-programs.repository.ts
// ::SET_LOG_HISTORY_LIMIT — sem isso, esta listagem (ao contrário das leituras
// aninhadas irmãs, que já tinham o cap) crescia sem limite pra sempre pra um
// usuário de longo prazo.
const SET_LOG_HISTORY_LIMIT = 100;

export const setlogsRepository = {
  async findWorkoutExerciseById(workoutExerciseId: string) {
    return prisma.workoutExercise.findUnique({ where: { id: workoutExerciseId } });
  },

  async create(workoutExerciseId: string, setNumber: number, repsDone: number, weightKg: number) {
    return prisma.setLog.create({
      data: { workoutExerciseId, setNumber, repsDone, weightKg },
    });
  },

  async findAllByWorkoutExercise(workoutExerciseId: string) {
    // desc + take = "os N mais recentes"; revertido pra asc logo abaixo (o
    // frontend depende dessa ordem — ver SET_LOG_HISTORY_LIMIT acima), mesmo
    // padrão já usado pelas leituras aninhadas irmãs.
    const setLogs = await prisma.setLog.findMany({
      where: { workoutExerciseId },
      orderBy: { loggedAt: "desc" },
      take: SET_LOG_HISTORY_LIMIT,
    });
    return setLogs.reverse();
  },
};
