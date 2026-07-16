"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDietPlan } from "@/lib/api/nutrition";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { QueryError } from "@/components/query-error";
import { DietPlanView } from "@/components/diet-plan-view";

function DietaContent() {
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const planQuery = useQuery({
    queryKey: ["diet-plan", planId],
    queryFn: () => getDietPlan(planId),
  });

  if (planQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">Carregando plano...</span>
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

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          Plano alimentar
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h1>
      </div>

      <DietPlanView plan={plan} />
    </main>
  );
}

export default function DietaPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <AppHeader />
      <DietaContent />
    </AuthGuard>
  );
}
