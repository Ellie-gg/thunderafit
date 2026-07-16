import prisma from "../../lib/prisma";

export const foodsRepository = {
  async findAll() {
    return prisma.food.findMany({ orderBy: { name: "asc" } });
  },

  async findById(id: string) {
    return prisma.food.findUnique({ where: { id } });
  },
};
