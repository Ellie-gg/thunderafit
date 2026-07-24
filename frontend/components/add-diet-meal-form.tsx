"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDietMeal } from "@/lib/api/nutrition";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AddDietMealForm({ planId, nextOrder }: { planId: string; nextOrder: number }) {
  const t = useTranslations("addDietMealForm");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [time, setTime] = useState("12:00");

  const mutation = useMutation({
    mutationFn: () => addDietMeal(planId, { name, time, order: nextOrder }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["diet-plan", planId] });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mealName">{t("nomeRefeicaoLabel")}</Label>
          <Input
            id="mealName"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mealTime">{t("horarioLabel")}</Label>
          <Input
            id="mealTime"
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("errorAdding")}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t("adding") : t("addButton")}
      </Button>
    </form>
  );
}
