"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { registerRequest, loginRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ALUNO");

  const mutation = useMutation({
    mutationFn: async () => {
      await registerRequest(email, password, role);
      return loginRequest(email, password);
    },
    onSuccess: (data) => {
      setSession(data.user);
      router.push("/dashboard");
    },
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-2">
        <span className="text-3xl" aria-hidden>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          ThunderaFit
        </h1>
      </div>

      <Card className="w-full max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Você é</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={role === "ALUNO" ? "default" : "secondary"}
                className="flex-1"
                onClick={() => setRole("ALUNO")}
              >
                Aluno
              </Button>
              <Button
                type="button"
                variant={role === "PERSONAL" ? "default" : "secondary"}
                className="flex-1"
                onClick={() => setRole("PERSONAL")}
              >
                Personal Trainer
              </Button>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-danger">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : "Não foi possível conectar ao servidor."}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="mt-2">
            {mutation.isPending ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-accent-secondary hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
