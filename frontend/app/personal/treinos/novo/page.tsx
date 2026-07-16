"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { createWorkout } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

const LETRAS = ["A", "B", "C", "D"];

function NovoTreinoContent() {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState("");
  const [name, setName] = useState("");
  const [letter, setLetter] = useState("A");

  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });

  const mutation = useMutation({
    mutationFn: () => createWorkout({ alunoId, name, letter }),
    onSuccess: (data) => {
      router.push(`/personal/treinos/${data.workout.id}`);
    },
  });

  const alunos = relationsQuery.data?.relations ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <h1 className="mb-4 font-display text-xl font-bold">Criar novo treino</h1>

          {relationsQuery.isLoading && <p className="mb-4 text-sm text-muted">Carregando alunos...</p>}

          {relationsQuery.isError && (
            <div className="mb-4">
              <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
            </div>
          )}

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aluno">Aluno</Label>
              <select
                id="aluno"
                required
                value={alunoId}
                onChange={(e) => setAlunoId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="" disabled>
                  Selecione um aluno
                </option>
                {alunos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email}
                  </option>
                ))}
              </select>
              {relationsQuery.isSuccess && alunos.length === 0 && (
                <p className="text-xs text-muted">
                  Você ainda não tem alunos vinculados — vincule um antes de criar um treino.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome do treino</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Peito e Tríceps"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="letter">Letra</Label>
              <div className="flex gap-2">
                {LETRAS.map((l) => (
                  <Button
                    key={l}
                    type="button"
                    variant={letter === l ? "default" : "secondary"}
                    className="flex-1"
                    onClick={() => setLetter(l)}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>

            {mutation.isError && (
              <p className="text-sm text-danger">
                {mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Não foi possível conectar ao servidor."}
              </p>
            )}

            <Button type="submit" disabled={mutation.isPending || alunos.length === 0}>
              {mutation.isPending ? "Criando..." : "Criar treino"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}

export default function NovoTreinoPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <NovoTreinoContent />
    </AuthGuard>
  );
}
