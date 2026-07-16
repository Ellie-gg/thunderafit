"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkoutPrograms, createWorkoutProgram } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

function ProgramasPersonalContent() {
  const queryClient = useQueryClient();
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal"],
    queryFn: () => listWorkoutPrograms(),
  });
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createWorkoutProgram(name.trim()),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] });
    },
  });

  const programs = programsQuery.data?.programs ?? [];
  const templates = programs.filter((p) => p.isTemplate);
  const instances = programs.filter((p) => !p.isTemplate);

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Programas de Treino</h1>

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Novo programa (template)</h2>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome do programa</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Masculino Avançado ABCDE"
              />
            </div>
            {createMutation.isError && (
              <p className="text-sm text-danger">
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "Erro ao criar programa."}
              </p>
            )}
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? "Criando..." : "Criar template"}
            </Button>
          </form>
        </Card>

        {programsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Templates ({templates.length})</h2>
          {templates.length === 0 && <p className="text-sm text-muted">Nenhum template ainda.</p>}
          {templates.map((p) => (
            <Link key={p.id} href={`/personal/programas/${p.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <p className="text-xs text-muted">{p.workouts?.length ?? 0} sessão(ões)</p>
                </div>
                <span className="text-sm text-muted">Abrir →</span>
              </Card>
            </Link>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Aplicados a alunos ({instances.length})</h2>
          {instances.length === 0 && (
            <p className="text-sm text-muted">Nenhum programa aplicado a alunos ainda.</p>
          )}
          {instances.map((p) => (
            <Link key={p.id} href={`/personal/programas/${p.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <p className="text-xs text-muted">{p.workouts?.length ?? 0} sessão(ões)</p>
                </div>
                <span className="text-sm text-muted">Abrir →</span>
              </Card>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}

export default function ProgramasPersonalPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL", "NUTRICIONISTA"]}>
      <ProgramasPersonalContent />
    </AuthGuard>
  );
}
