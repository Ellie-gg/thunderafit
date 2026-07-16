"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listFoods, addDietFood } from "@/lib/api/nutrition";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

export function AddDietFoodForm({ planId, mealId }: { planId: string; mealId: string }) {
  const queryClient = useQueryClient();
  const foodsQuery = useQuery({ queryKey: ["foods"], queryFn: listFoods });

  const [filter, setFilter] = useState("");
  const [foodId, setFoodId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const filtered = useMemo(() => {
    const all = foodsQuery.data?.foods ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((f) => f.name.toLowerCase().includes(q));
  }, [foodsQuery.data, filter]);

  const mutation = useMutation({
    mutationFn: () => addDietFood(planId, mealId, { foodId, quantity: Number(quantity) }),
    onSuccess: () => {
      setFoodId("");
      queryClient.invalidateQueries({ queryKey: ["diet-plan", planId] });
    },
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      {foodsQuery.isLoading && <p className="text-xs text-muted">Carregando catálogo...</p>}

      {foodsQuery.isError && (
        <QueryError error={foodsQuery.error} onRetry={() => foodsQuery.refetch()} />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`filter-${mealId}`}>Buscar alimento</Label>
        <Input
          id={`filter-${mealId}`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Ex: frango, arroz..."
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`food-${mealId}`}>Alimento</Label>
          <select
            id={`food-${mealId}`}
            required
            value={foodId}
            onChange={(e) => setFoodId(e.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="" disabled>
              {filtered.length} alimento(s) — selecione
            </option>
            {filtered.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.portionDescription})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`qty-${mealId}`}>Porções</Label>
          <Input
            id={`qty-${mealId}`}
            type="number"
            min={0.5}
            step={0.5}
            required
            className="w-24"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : "Erro ao adicionar alimento."}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending || !foodId} variant="secondary">
        {mutation.isPending ? "Adicionando..." : "Adicionar alimento"}
      </Button>
    </form>
  );
}
