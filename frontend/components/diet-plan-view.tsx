"use client";

import { useTranslations } from "next-intl";
import type { DietPlanDetail } from "@/lib/types";
import { Card } from "@/components/ui/card";

function MacroRow({ macros }: { macros: DietPlanDetail["totalMacros"] }) {
  const t = useTranslations("dietPlanView");
  return (
    <div className="grid grid-cols-4 gap-2 font-mono-nums text-xs text-muted">
      <span>{t("macros.protein", { value: macros.proteinG })}</span>
      <span>{t("macros.carbs", { value: macros.carbsG })}</span>
      <span>{t("macros.fat", { value: macros.fatG })}</span>
      <span>{t("macros.kcal", { value: macros.kcal })}</span>
    </div>
  );
}

export function DietPlanView({ plan }: { plan: DietPlanDetail }) {
  const t = useTranslations("dietPlanView");
  const meals = [...plan.meals].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 border-accent/40">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          {t("totalOfDay")}
        </span>
        <MacroRow macros={plan.totalMacros} />
      </Card>

      {meals.map((meal) => (
        <Card key={meal.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono-nums text-xs text-muted">{meal.time}</span>{" "}
              <span className="font-display font-bold">{meal.name}</span>
            </div>
          </div>

          {meal.foods.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {meal.foods.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span>
                    {f.foodName}{" "}
                    <span className="text-xs text-muted">
                      ({f.quantity}x {f.portionDescription})
                    </span>
                  </span>
                  <span className="font-mono-nums text-xs text-muted">
                    {t("macros.kcal", { value: f.macros.kcal })}
                  </span>
                </div>
              ))}
            </div>
          )}
          {meal.foods.length === 0 && (
            <p className="text-sm text-muted">{t("noFoods")}</p>
          )}

          <MacroRow macros={meal.macros} />
        </Card>
      ))}

      {meals.length === 0 && (
        <Card>
          <p className="text-sm text-muted">{t("noMeals")}</p>
        </Card>
      )}
    </div>
  );
}
