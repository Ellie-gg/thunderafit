"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getDietPlan } from "@/lib/api/nutrition";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { DietPlanView } from "@/components/diet-plan-view";
import { AddDietMealForm } from "@/components/add-diet-meal-form";
import { AddDietFoodForm } from "@/components/add-diet-food-form";

function NutricionistaPlanoContent() {
  const t = useTranslations("planoDietaDetail");
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const planQuery = useQuery({
    queryKey: ["diet-plan", planId],
    queryFn: () => getDietPlan(planId),
  });

  if (planQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">{t("loadingPlan")}</span>
      </main>
    );
  }

  if (planQuery.isError) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <QueryError error={planQuery.error} onRetry={() => planQuery.refetch()} />
      </main>
    );
  }

  if (!planQuery.data) return null;

  const plan = planQuery.data.plan;
  const nextOrder = plan.meals.length + 1;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h1>
        <p className="text-sm text-muted">{t("mealsCount", { count: plan.meals.length })}</p>
      </div>

      <DietPlanView plan={plan} />

      {plan.meals.map((meal) => (
        <Card key={meal.id} className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-bold">
            {t("addFoodHeading", { name: meal.name, time: meal.time })}
          </h2>
          <AddDietFoodForm planId={planId} mealId={meal.id} />
        </Card>
      ))}

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold">{t("addMealHeading")}</h2>
        <AddDietMealForm planId={planId} nextOrder={nextOrder} />
      </Card>
    </main>
  );
}

export default function NutricionistaPlanoPage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <AppHeader />
      <NutricionistaPlanoContent />
    </AuthGuard>
  );
}
