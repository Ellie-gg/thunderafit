import prisma from "../../lib/prisma";

export const dietPlansRepository = {
  // Fase 17 (Item 5): criar um plano desativa os planos ativos anteriores do
  // MESMO aluno (um único plano ativo por vez), numa transação — o novo já
  // nasce ativo. O dashboard do aluno usa o plano ativo.
  async create(nutricionistaId: string, alunoId: string, name: string) {
    return prisma.$transaction(async (tx) => {
      await tx.dietPlan.updateMany({
        where: { alunoId, isActive: true },
        data: { isActive: false },
      });
      return tx.dietPlan.create({
        data: { nutricionistaId, alunoId, name, isActive: true },
      });
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
