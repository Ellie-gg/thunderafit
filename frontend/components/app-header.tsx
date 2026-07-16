"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { logoutRequest } from "@/lib/api/auth";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";

export function AppHeader() {
  const router = useRouter();
  const { user, clearSession } = useAuthStore();

  return (
    <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-6">
      <Link
        href={user ? dashboardPathForRole(user.role) : "/login"}
        className="flex shrink-0 items-center gap-2"
      >
        <span className="text-xl" aria-hidden>
          ⚡
        </span>
        <span className="hidden font-display text-sm font-bold tracking-tight sm:inline">
          ThunderaFit
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {/* Links de texto só a partir de sm — em telas de celular eles cabem
            mal ao lado do sino e do botão Sair; ficam disponíveis também nos
            respectivos dashboards. */}
        {user?.role === "ALUNO" && (
          <>
            <Link
              href="/evolucao"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Evolução
            </Link>
            <Link
              href="/anamnese"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Anamnese
            </Link>
            <Link
              href="/duvidas"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Dúvidas
            </Link>
          </>
        )}
        {user?.role === "PERSONAL" && (
          <Link
            href="/personal/duvidas"
            className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
          >
            Dúvidas
          </Link>
        )}
        {user && <NotificationBell />}
        <span className="hidden text-sm text-muted sm:inline">{user?.email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await logoutRequest();
            } finally {
              // Mesmo se a chamada falhar (ex: sessão já expirada), limpa o
              // estado local — o objetivo do clique é sempre sair.
              clearSession();
              router.replace("/login");
            }
          }}
        >
          Sair
        </Button>
      </div>
    </header>
  );
}
