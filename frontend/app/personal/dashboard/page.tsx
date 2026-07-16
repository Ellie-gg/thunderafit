"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listMyWorkouts } from "@/lib/api/workouts";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";

function PersonalDashboardContent() {
  const user = useAuthStore((s) => s.user);

  const relationsQuery = useQuery({
    queryKey: ["relations"],
    queryFn: listRelations,
  });

  const workoutsQuery = useQuery({
    queryKey: ["workouts"],
    queryFn: listMyWorkouts,
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
          <p className="text-sm text-muted">Seus alunos e treinos prescritos.</p>
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
          <VoltageBar total={limite} filled={alunos.length} role="PERSONAL" />

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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    desde {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <Link
                    href={`/personal/alunos/${a.id}/anamnese`}
                    className="text-xs font-semibold text-accent-secondary hover:underline"
                  >
                    Anamnese
                  </Link>
                </div>
              </div>
            ))}
            {relationsQuery.isSuccess && alunos.length === 0 && (
              <p className="text-sm text-muted">Nenhum aluno vinculado ainda.</p>
            )}
          </div>

          <Button asChild variant={noLimite ? "secondary" : "default"} disabled={noLimite}>
            <Link href={noLimite ? "#" : "/personal/alunos/novo"}>
              {noLimite ? "Limite atingido" : "Vincular novo aluno"}
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              Treinos prescritos
            </span>
          </div>

          {workoutsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

          {workoutsQuery.isError && (
            <QueryError error={workoutsQuery.error} onRetry={() => workoutsQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {workoutsQuery.data?.workouts.map((w) => (
              <Link key={w.id} href={`/personal/treinos/${w.id}`}>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-accent">
                  <span>
                    <span className="font-display font-bold text-accent">{w.letter}</span>{" "}
                    {w.name}
                  </span>
                  <span className="text-xs text-muted">Ver →</span>
                </div>
              </Link>
            ))}
            {workoutsQuery.isSuccess && workoutsQuery.data.workouts.length === 0 && (
              <p className="text-sm text-muted">Nenhum treino criado ainda.</p>
            )}
          </div>

          <Button asChild variant="secondary" disabled={alunos.length === 0}>
            <Link href={alunos.length === 0 ? "#" : "/personal/treinos/novo"}>
              Criar novo treino
            </Link>
          </Button>
        </Card>

        {/* Atalho visível também aqui — no celular, o link de texto do
            header fica escondido por falta de espaço. */}
        <Link
          href="/personal/duvidas"
          className="text-sm font-semibold text-accent-secondary hover:underline sm:hidden"
        >
          Ver dúvidas dos alunos →
        </Link>
      </main>
    </>
  );
}

export default function PersonalDashboardPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <PersonalDashboardContent />
    </AuthGuard>
  );
}
