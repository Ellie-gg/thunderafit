import { apiFetch } from "./client";
import type { DietPlan, DietPlanDetail, Food } from "../types";

export function listFoods() {
  return apiFetch<{ foods: Food[] }>("/api/foods");
}

export function listMyDietPlans() {
  return apiFetch<{ plans: DietPlan[] }>("/api/diet-plans");
}

export function getDietPlan(planId: string) {
  return apiFetch<{ plan: DietPlanDetail }>(`/api/diet-plans/${planId}`);
}

export function createDietPlan(input: { alunoId: string; name: string }) {
  return apiFetch<{ plan: DietPlan }>("/api/diet-plans", { method: "POST", body: input });
}

export function addDietMeal(
  planId: string,
  input: { name: string; time: string; order: number }
) {
  return apiFetch<{ meal: { id: string } }>(`/api/diet-plans/${planId}/meals`, {
    method: "POST",
    body: input,
  });
}

export function addDietFood(
  planId: string,
  mealId: string,
  input: { foodId: string; quantity: number }
) {
  return apiFetch<{ dietFood: unknown }>(`/api/diet-plans/${planId}/meals/${mealId}/foods`, {
    method: "POST",
    body: input,
  });
}
