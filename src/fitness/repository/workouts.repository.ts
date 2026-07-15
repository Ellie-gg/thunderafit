import prisma from "../../lib/prisma";

export const workoutsRepository = {
  async create(personalId: string, alunoId: string, name: string, letter: string) {
    return prisma.workout.create({
      data: { personalId, alunoId, name, letter },
    });
  },

  async findById(id: string) {
    return prisma.workout.findUnique({ where: { id } });
  },

  async findAllByAluno(alunoId: string) {
    return prisma.workout.findMany({ where: { alunoId }, orderBy: { createdAt: "asc" } });
  },

  async findAllByPersonal(personalId: string) {
    return prisma.workout.findMany({ where: { personalId }, orderBy: { createdAt: "asc" } });
  },

  async findByIdWithExercises(id: string) {
    return prisma.workout.findUnique({
      where: { id },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: true,
            setLogs: { orderBy: { loggedAt: "asc" } },
          },
        },
      },
    });
  },

  async addExercise(
    workoutId: string,
    exerciseId: string,
    sets: number,
    repsRange: string,
    restSeconds: number,
    order: number
  ) {
    return prisma.workoutExercise.create({
      data: { workoutId, exerciseId, sets, repsRange, restSeconds, order },
    });
  },
};
