"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { registerRequest, loginRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { ROLE_META, isRole, ROLE_ORDER } from "@/lib/roles";
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

  // Fase 18 (Item 3): só papéis expostos publicamente (ROLE_ORDER) podem
  // cadastrar. `role=NUTRICIONISTA` na URL não é mais alcançável — cai como
  // inválido e volta para a tela inicial, igual a um role desconhecido.
  const roleParam = searchParams.get("role");
  const role = isRole(roleParam) && ROLE_ORDER.includes(roleParam) ? roleParam : null;

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
      {/* Fase 18 (Item 1): sinal de "cadastro" é o CIANO (chip/borda/botão),
          fixo — NÃO a cor do papel, senão um Personal (cujo acento já é
          dourado) ficaria idêntico à tela de login. O acento de papel da
          Fase 12 segue só no glifo ⚡. */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <span className="rounded-full border border-accent-secondary/50 bg-accent-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-secondary">
          Cadastro
        </span>
        <span className="text-3xl" aria-hidden style={{ color: meta.accentVar }}>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Criar conta
        </h1>
        <p className="text-sm text-muted">
          {meta.label} · {meta.tagline}
        </p>
      </div>

      <Card
        className="w-full max-w-sm"
        style={{ borderTopWidth: "4px", borderTopColor: "var(--accent-secondary)" }}
      >
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

          <Button
            type="submit"
            variant="accentSecondary"
            disabled={mutation.isPending}
            className="mt-2"
          >
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
