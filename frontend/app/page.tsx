"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { ROLE_META, ROLE_ORDER } from "@/lib/roles";

/**
 * Tela inicial (Fase 12, Item 1): antes só redirecionava direto para /login,
 * sem indicar os 3 perfis possíveis. Agora, para quem ainda não tem sessão,
 * mostra 3 boxes grandes — a escolha de papel acontece aqui, não mais dentro
 * do formulário de /register (que agora só recebe o papel já escolhido via
 * query string).
 */
function RoleBox({ role }: { role: (typeof ROLE_META)[keyof typeof ROLE_META] }) {
  return (
    <Link
      href={`/register?role=${role.role}`}
      className="flex flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-6 text-left transition-colors hover:border-[var(--box-accent)]"
      style={{
        ["--box-accent" as string]: role.accentVar,
        borderTopWidth: "4px",
        borderTopColor: role.accentVar,
      }}
    >
      {/* O emoji ⚡ usa fonte de emoji colorida (ignora `color` do CSS) — o
          acento por papel vive na borda superior, não no glifo. */}
      <span className="text-2xl" aria-hidden>
        ⚡
      </span>
      <span className="font-display text-lg font-bold">{role.label}</span>
      <span className="text-sm text-muted">{role.tagline}</span>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && user) {
      router.replace(dashboardPathForRole(user.role));
    }
  }, [isHydrated, user, router]);

  if (!isHydrated || user) {
    return null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <span className="text-3xl" aria-hidden>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          ThunderaFit
        </h1>
        <p className="text-sm text-muted">Como você quer entrar?</p>
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row">
        {ROLE_ORDER.map((role) => (
          <RoleBox key={role} role={ROLE_META[role]} />
        ))}
      </div>

      <p className="text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-accent-secondary hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
