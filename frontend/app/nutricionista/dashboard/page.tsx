"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listMyDietPlans } from "@/lib/api/nutrition";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";

function NutricionistaDashboardContent() {
  const user = useAuthStore((s) => s.user);

  const relationsQuery = useQuery({
    queryKey: ["relations"],
    queryFn: listRelations,
  });

  const plansQuery = useQuery({
    queryKey: ["diet-plans"],
    queryFn: listMyDietPlans,
  });

  const alunos = relationsQuery.data?.relations ?? [];
  const limite = user?.limiteAlunos ?? 0;
  const noLimite = alunos.length >= limite;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Olá, {user?.email.split("@")[0]}
          </h1>
          <p className="text-sm text-muted">Seus alunos e planos alimentares prescritos.</p>
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              Alunos vinculados
            </span>
            <span className="font-mono-nums text-xs text-muted">
              {alunos.length}/{limite}
            </span>
          </div>
          <VoltageBar total={limite} filled={alunos.length} />

          {noLimite && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              Limite de alunos atingido. Faça upgrade do plano para vincular mais alunos.
            </p>
          )}

          {relationsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

          {relationsQuery.isError && (
            <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {alunos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{a.email}</span>
                <span className="text-xs text-muted">
                  desde {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
            {relationsQuery.isSuccess && alunos.length === 0 && (
              <p className="text-sm text-muted">Nenhum aluno vinculado ainda.</p>
            )}
          </div>

          <Button asChild variant={noLimite ? "secondary" : "default"} disabled={noLimite}>
            <Link href={noLimite ? "#" : "/nutricionista/alunos/novo"}>
              {noLimite ? "Limite atingido" : "Vincular novo aluno"}
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              Planos de dieta prescritos
            </span>
          </div>

          {plansQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

          {plansQuery.isError && (
            <QueryError error={plansQuery.error} onRetry={() => plansQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {plansQuery.data?.plans.map((p) => (
              <Link key={p.id} href={`/nutricionista/planos/${p.id}`}>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-accent">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">Ver →</span>
                </div>
              </Link>
            ))}
            {plansQuery.isSuccess && plansQuery.data.plans.length === 0 && (
              <p className="text-sm text-muted">Nenhum plano de dieta criado ainda.</p>
            )}
          </div>

          <Button asChild variant="secondary" disabled={alunos.length === 0}>
            <Link href={alunos.length === 0 ? "#" : "/nutricionista/planos/novo"}>
              Criar novo plano de dieta
            </Link>
          </Button>
        </Card>
      </main>
    </>
  );
}

export default function NutricionistaDashboardPage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <NutricionistaDashboardContent />
    </AuthGuard>
  );
}
