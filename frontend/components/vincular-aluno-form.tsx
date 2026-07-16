"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lookupAlunoByEmail, createRelation } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function VincularAlunoForm({ dashboardPath }: { dashboardPath: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { user } = await lookupAlunoByEmail(email);
      return createRelation(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relations"] });
      router.push(dashboardPath);
    },
  });

  function errorMessage(): string {
    if (!(mutation.error instanceof ApiError)) {
      return "Não foi possível conectar ao servidor.";
    }
    switch (mutation.error.status) {
      case 404:
        return "Não existe nenhum aluno cadastrado com esse e-mail.";
      case 409:
        return "Esse aluno já está vinculado a você.";
      case 403:
        return "Você atingiu o limite de alunos do seu plano. Faça upgrade para vincular mais.";
      default:
        return mutation.error.message;
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-4 font-display text-xl font-bold">Vincular novo aluno</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail do aluno</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aluno@exemplo.com"
          />
        </div>

        {mutation.isError && <p className="text-sm text-danger">{errorMessage()}</p>}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Vinculando..." : "Vincular aluno"}
        </Button>
      </form>
    </Card>
  );
}
