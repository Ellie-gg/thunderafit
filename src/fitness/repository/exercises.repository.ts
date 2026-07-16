import prisma from "../../lib/prisma";

export const exercisesRepository = {
  async findAll(muscleGroup?: string) {
    return prisma.exercise.findMany({
      where: muscleGroup ? { muscleGroup } : undefined,
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.exercise.findUnique({ where: { id } });
  },
};
