import prisma from "../../lib/prisma";

export const exercisesRepository = {
  async findAll() {
    return prisma.exercise.findMany({ orderBy: { name: "asc" } });
  },

  async findById(id: string) {
    return prisma.exercise.findUnique({ where: { id } });
  },
};
