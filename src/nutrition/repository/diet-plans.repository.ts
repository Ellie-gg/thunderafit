import prisma from "../../lib/prisma";

export const dietPlansRepository = {
  async create(nutricionistaId: string, alunoId: string, name: string) {
    return prisma.dietPlan.create({
      data: { nutricionistaId, alunoId, name },
    });
  },

  async findById(id: string) {
    return prisma.dietPlan.findUnique({ where: { id } });
  },

  async findAllByAluno(alunoId: string) {
    return prisma.dietPlan.findMany({ where: { alunoId }, orderBy: { createdAt: "asc" } });
  },

  async findAllByNutricionista(nutricionistaId: string) {
    return prisma.dietPlan.findMany({ where: { nutricionistaId }, orderBy: { createdAt: "asc" } });
  },

  async findByIdWithMeals(id: string) {
    return prisma.dietPlan.findUnique({
      where: { id },
      include: {
        meals: {
          orderBy: { order: "asc" },
          include: {
            foods: {
              include: { food: true },
            },
          },
        },
      },
    });
  },

  async addMeal(dietPlanId: string, name: string, time: string, order: number) {
    return prisma.dietMeal.create({
      data: { dietPlanId, name, time, order },
    });
  },

  async findMealById(id: string) {
    return prisma.dietMeal.findUnique({ where: { id } });
  },

  async addFood(dietMealId: string, foodId: string, quantity: number) {
    return prisma.dietFood.create({
      data: { dietMealId, foodId, quantity },
    });
  },
};
