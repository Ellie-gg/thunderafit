import { dietPlansRepository } from "../repository/diet-plans.repository";
import { foodsRepository } from "../repository/foods.repository";
import { relationsRepository } from "../../fitness/repository/relations.repository";

function macrosOf(food: { proteinG: number; carbsG: number; fatG: number; kcal: number }, quantity: number) {
  return {
    proteinG: Math.round(food.proteinG * quantity * 10) / 10,
    carbsG: Math.round(food.carbsG * quantity * 10) / 10,
    fatG: Math.round(food.fatG * quantity * 10) / 10,
    kcal: Math.round(food.kcal * quantity * 10) / 10,
  };
}

function sumMacros(list: Array<{ proteinG: number; carbsG: number; fatG: number; kcal: number }>) {
  return list.reduce(
    (acc, m) => ({
      proteinG: Math.round((acc.proteinG + m.proteinG) * 10) / 10,
      carbsG: Math.round((acc.carbsG + m.carbsG) * 10) / 10,
      fatG: Math.round((acc.fatG + m.fatG) * 10) / 10,
      kcal: Math.round((acc.kcal + m.kcal) * 10) / 10,
    }),
    { proteinG: 0, carbsG: 0, fatG: 0, kcal: 0 }
  );
}

export const dietPlansService = {
  async createDietPlan(nutricionistaId: string, alunoId: string, name: string) {
    // Mesma checagem de vínculo usada em POST /api/workouts (Fase 3), mas
    // pelo par (nutricionistaId, alunoId) — o campo `personalId` do
    // ClientRelation guarda o id do profissional autenticado, seja Personal
    // ou Nutricionista (ver Fase 11, Bloco 1).
    const relation = await relationsRepository.findByPersonalAndAluno(nutricionistaId, alunoId);
    if (!relation || relation.professionalType !== "NUTRICIONISTA") {
      const err = new Error("Aluno não vinculado a este Nutricionista.");
      (err as any).statusCode = 403;
      throw err;
    }

    return dietPlansRepository.create(nutricionistaId, alunoId, name);
  },

  async listPlansForUser(
    userId: string,
    role: "ALUNO" | "NUTRICIONISTA" | "PERSONAL" | "ADMIN",
    adminTarget?: { alunoId?: string; nutricionistaId?: string }
  ) {
    if (role === "ADMIN") {
      // Admin não tem planos próprios — visão ampliada de um aluno ou
      // Nutricionista específico, sem assumir a identidade de nenhum dos dois.
      if (adminTarget?.alunoId) {
        return dietPlansRepository.findAllByAluno(adminTarget.alunoId);
      }
      if (adminTarget?.nutricionistaId) {
        return dietPlansRepository.findAllByNutricionista(adminTarget.nutricionistaId);
      }
      return [];
    }
    if (role === "ALUNO") {
      return dietPlansRepository.findAllByAluno(userId);
    }
    return dietPlansRepository.findAllByNutricionista(userId);
  },

  async addMeal(dietPlanId: string, nutricionistaId: string, name: string, time: string, order: number) {
    const plan = await dietPlansRepository.findById(dietPlanId);
    if (!plan || plan.nutricionistaId !== nutricionistaId) {
      const err = new Error("Plano de dieta não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    return dietPlansRepository.addMeal(dietPlanId, name, time, order);
  },

  async addFood(dietMealId: string, nutricionistaId: string, foodId: string, quantity: number) {
    const meal = await dietPlansRepository.findMealById(dietMealId);
    if (!meal) {
      const err = new Error("Refeição não encontrada.");
      (err as any).statusCode = 404;
      throw err;
    }
    const plan = await dietPlansRepository.findById(meal.dietPlanId);
    if (!plan || plan.nutricionistaId !== nutricionistaId) {
      const err = new Error("Refeição não encontrada.");
      (err as any).statusCode = 404;
      throw err;
    }
    const food = await foodsRepository.findById(foodId);
    if (!food) {
      const err = new Error("Alimento não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    return dietPlansRepository.addFood(dietMealId, foodId, quantity);
  },

  async getDietPlan(dietPlanId: string, userId: string, role?: string) {
    const plan = await dietPlansRepository.findByIdWithMeals(dietPlanId);
    if (!plan) {
      const err = new Error("Plano de dieta não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    if (role !== "ADMIN" && plan.alunoId !== userId && plan.nutricionistaId !== userId) {
      const err = new Error("Você não tem permissão para acessar este plano de dieta.");
      (err as any).statusCode = 403;
      throw err;
    }

    const meals = plan.meals.map((meal) => {
      const foodsWithMacros = meal.foods.map((df) => ({
        id: df.id,
        foodId: df.foodId,
        foodName: df.food.name,
        portionDescription: df.food.portionDescription,
        quantity: df.quantity,
        macros: macrosOf(df.food, df.quantity),
      }));
      return {
        id: meal.id,
        name: meal.name,
        time: meal.time,
        order: meal.order,
        foods: foodsWithMacros,
        macros: sumMacros(foodsWithMacros.map((f) => f.macros)),
      };
    });

    return {
      id: plan.id,
      nutricionistaId: plan.nutricionistaId,
      alunoId: plan.alunoId,
      name: plan.name,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      meals,
      totalMacros: sumMacros(meals.map((m) => m.macros)),
    };
  },
};
