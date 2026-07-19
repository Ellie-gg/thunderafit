"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { checkEmailRequest, loginRequest, registerRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { Role } from "@/lib/types";

/**
 * Fase 24 (Parte 2): fluxo unificado — uma tela só de e-mail decide entre
 * login e cadastro (POST /api/auth/check-email, Parte 1). Substitui as
 * antigas /login e /register separadas.
 */
type Step = "email" | "login" | "signup-role" | "signup-details";
type SignupRole = Extract<Role, "ALUNO" | "PERSONAL">;

const SIGNUP_ROLE_COPY: Record<SignupRole, { chip: string; description: string }> = {
  ALUNO: {
    chip: "Treinar",
    description: "Monte seus próprios treinos ou acompanhe o que seu Personal te passou.",
  },
  PERSONAL: {
    chip: "Personal",
    description: "Entre para gerenciar seus alunos, prescrever e acompanhar treinos.",
  },
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar ao servidor.";
}

// Fase 32.1: alterna a senha entre oculta/visível — útil pra conferir o que
// foi digitado quando o login falha por senha errada, sem depender do
// gerenciador de senha do navegador (que nem sempre está ativo).
function PasswordField({
  id,
  value,
  onChange,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="pr-16"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-muted hover:text-foreground"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

function RoleChip({
  signupRole,
  active,
  onClick,
}: {
  signupRole: SignupRole;
  active: boolean;
  onClick: () => void;
}) {
  const activeClasses =
    signupRole === "PERSONAL"
      ? "border-accent bg-accent/10 text-accent"
      : "border-accent-secondary bg-accent-secondary/10 text-accent-secondary";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border py-3 font-display text-sm font-semibold transition-colors ${
        active ? activeClasses : "border-border text-muted hover:border-foreground/30"
      }`}
    >
      {SIGNUP_ROLE_COPY[signupRole].chip}
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole | null>(null);

  const checkEmailMutation = useMutation({
    mutationFn: () => checkEmailRequest(email.trim()),
    onSuccess: ({ exists }) => setStep(exists ? "login" : "signup-role"),
  });

  const loginMutation = useMutation({
    mutationFn: () => loginRequest(email.trim(), password),
    onSuccess: (data) => {
      setSession(data.user);
      router.push(dashboardPathForRole(data.user.role));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      await registerRequest(email.trim(), password, signupRole!);
      return loginRequest(email.trim(), password); // encadeia login pra pegar cookies+user, mesmo padrão do /register antigo
    },
    onSuccess: (data) => {
      setSession(data.user);
      router.push(dashboardPathForRole(data.user.role));
    },
  });

  function backToEmail() {
    setStep("email");
    setPassword("");
    setSignupRole(null);
    checkEmailMutation.reset();
  }

  const emailLooksValid = /\S+@\S+\.\S+/.test(email);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3">
        <span className="text-3xl" aria-hidden>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          ThunderaFit
        </h1>
      </div>

      {step === "email" && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
        >
          <h2 className="mb-1 font-display text-xl font-bold text-foreground">
            Entrar ou criar conta
          </h2>
          <p className="mb-5 text-sm text-muted">
            Digite seu e-mail pra começar. A gente identifica o resto.
          </p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              checkEmailMutation.mutate();
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

            {checkEmailMutation.isError && (
              <p className="text-sm text-danger">{errorMessage(checkEmailMutation.error)}</p>
            )}

            <Button
              type="submit"
              disabled={!emailLooksValid || checkEmailMutation.isPending}
              className="mt-2"
            >
              {checkEmailMutation.isPending ? "Verificando..." : "Continuar"}
            </Button>
          </form>
        </Card>
      )}

      {step === "login" && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
        >
          <button
            type="button"
            onClick={backToEmail}
            className="mb-4 text-xs font-semibold text-muted hover:text-foreground"
          >
            ← trocar e-mail
          </button>

          <span className="mb-4 inline-block rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            Bem-vindo de volta
          </span>

          <h2 className="mb-1 font-display text-xl font-bold text-foreground">Entrar</h2>
          <p className="mb-5 text-sm text-muted">{email}</p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <PasswordField id="password" value={password} onChange={setPassword} />
            </div>

            {loginMutation.isError && (
              <p className="text-sm text-danger">{errorMessage(loginMutation.error)}</p>
            )}

            <Button type="submit" disabled={loginMutation.isPending} className="mt-2">
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Card>
      )}

      {step === "signup-role" && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent-secondary)" }}
        >
          <button
            type="button"
            onClick={backToEmail}
            className="mb-4 text-xs font-semibold text-muted hover:text-foreground"
          >
            ← trocar e-mail
          </button>

          <span className="mb-4 inline-block rounded-full border border-accent-secondary/50 bg-accent-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-secondary">
            Esse e-mail ainda não tem conta
          </span>

          <h2 className="mb-1 font-display text-xl font-bold text-foreground">
            Vamos criar sua conta
          </h2>
          <p className="mb-1 text-sm text-muted">{email}</p>
          <p className="mb-5 text-sm text-muted">
            Você é Personal Trainer ou está aqui pra treinar?
          </p>

          <div className="mb-2 flex gap-3">
            <RoleChip
              signupRole="ALUNO"
              active={signupRole === "ALUNO"}
              onClick={() => setSignupRole("ALUNO")}
            />
            <RoleChip
              signupRole="PERSONAL"
              active={signupRole === "PERSONAL"}
              onClick={() => setSignupRole("PERSONAL")}
            />
          </div>
          <p className="mb-5 min-h-10 text-xs text-muted">
            {signupRole ? SIGNUP_ROLE_COPY[signupRole].description : " "}
          </p>

          <Button
            type="button"
            variant="accentSecondary"
            disabled={!signupRole}
            onClick={() => setStep("signup-details")}
          >
            Continuar
          </Button>
        </Card>
      )}

      {step === "signup-details" && signupRole && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent-secondary)" }}
        >
          <button
            type="button"
            onClick={() => setStep("signup-role")}
            className="mb-4 text-xs font-semibold text-muted hover:text-foreground"
          >
            ← trocar perfil
          </button>

          <span className="mb-4 inline-block rounded-full border border-accent-secondary/50 bg-accent-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-secondary">
            {SIGNUP_ROLE_COPY[signupRole].chip}
          </span>

          <h2 className="mb-1 font-display text-xl font-bold text-foreground">Criar conta</h2>
          <p className="mb-5 text-sm text-muted">{email}</p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              registerMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <PasswordField id="password" value={password} onChange={setPassword} minLength={8} />
            </div>

            {registerMutation.isError && (
              <p className="text-sm text-danger">{errorMessage(registerMutation.error)}</p>
            )}

            <Button
              type="submit"
              variant="accentSecondary"
              disabled={registerMutation.isPending}
              className="mt-2"
            >
              {registerMutation.isPending ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
