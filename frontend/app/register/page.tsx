"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { registerRequest, loginRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { ROLE_META, isRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

/**
 * Fase 12 (Item 1): o papel não é mais escolhido aqui — vem da tela inicial
 * (`/`), via query string. Esta tela só sabe criar a conta para o papel já
 * decidido; se chegar sem um `role` válido (ex: link direto/bookmark antigo),
 * manda de volta para `/` para escolher primeiro.
 */
function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const roleParam = searchParams.get("role");
  const role = isRole(roleParam) ? roleParam : null;

  useEffect(() => {
    if (!role) {
      router.replace("/");
    }
  }, [role, router]);

  const mutation = useMutation({
    mutationFn: async () => {
      await registerRequest(email, password, role!);
      return loginRequest(email, password);
    },
    onSuccess: (data) => {
      setSession(data.user);
      router.push(dashboardPathForRole(data.user.role));
    },
  });

  if (!role) {
    return null;
  }

  const meta = ROLE_META[role];

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-2">
        <span className="text-3xl" aria-hidden style={{ color: meta.accentVar }}>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Cadastro — {meta.label}
        </h1>
        <p className="text-sm text-muted">{meta.tagline}</p>
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
        Não é {meta.label.toLowerCase()}?{" "}
        <Link href="/" className="font-semibold text-accent-secondary hover:underline">
          Escolher outro perfil
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-accent-secondary hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
