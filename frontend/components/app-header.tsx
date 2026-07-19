"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { logoutRequest } from "@/lib/api/auth";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import type { Role } from "@/lib/types";

const ROLE_ACCENT_VAR: Record<Role, string> = {
  PERSONAL: "var(--role-personal)",
  ALUNO: "var(--role-aluno)",
  NUTRICIONISTA: "var(--role-nutricionista)",
  ADMIN: "var(--role-admin)",
};

export function AppHeader() {
  const router = useRouter();
  const { user, clearSession } = useAuthStore();
  // Fase 31: o link "Perfil" só aparecia a partir do breakpoint sm — no
  // celular não havia NENHUM jeito de chegar em /perfil pra trocar a foto.
  // O ícone circular vira o ponto de entrada em qualquer largura de tela.
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  return (
    <header
      className="flex items-center justify-between gap-2 border-b-2 px-4 py-4 sm:px-6"
      style={{ borderBottomColor: user ? ROLE_ACCENT_VAR[user.role] : "var(--border)" }}
    >
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
        {/* Bolinha de acento por papel — o emoji ⚡ acima usa fonte de emoji
            colorida (ignora `color` do CSS), então o acento vive aqui em vez
            de tentar (sem efeito) tingir o glifo. */}
        {user && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            aria-hidden
            style={{ backgroundColor: ROLE_ACCENT_VAR[user.role] }}
          />
        )}
      </Link>

      <div className="flex items-center gap-3">
        {/* Links de texto só a partir de sm — em telas de celular eles cabem
            mal ao lado do sino e do botão Sair; ficam disponíveis também nos
            respectivos dashboards. */}
        {user?.role === "ALUNO" && (
          <>
            <Link
              href="/programas"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Programas
            </Link>
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
            <Link
              href="/profissionais"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Encontrar Personal
            </Link>
            <Link
              href="/perfil"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Perfil
            </Link>
          </>
        )}
        {user?.role === "PERSONAL" && (
          <>
            <Link
              href="/personal/programas"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Programas
            </Link>
            <Link
              href="/personal/solicitacoes"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Solicitações
            </Link>
            <Link
              href="/personal/duvidas"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Dúvidas
            </Link>
            <Link
              href="/personal/upgrade"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Planos
            </Link>
            <Link
              href="/personal/perfil"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Perfil
            </Link>
          </>
        )}
        {user?.role === "NUTRICIONISTA" && (
          <Link
            href="/nutricionista/duvidas"
            className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
          >
            Dúvidas
          </Link>
        )}
        {user?.role === "ADMIN" && (
          <>
            <Link
              href="/nimbus/usuarios"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Usuários
            </Link>
            <Link
              href="/nimbus/exercicios"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Exercícios
            </Link>
            <Link
              href="/nimbus/logins"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Logins
            </Link>
            <Link
              href="/nimbus/suporte"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Suporte
            </Link>
            <Link
              href="/nimbus/logs-acesso"
              className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
            >
              Logs de acesso
            </Link>
          </>
        )}
        {user && <NotificationBell />}
        {user && (
          <div className="relative">
            <button
              type="button"
              aria-label="Foto de perfil"
              aria-expanded={avatarMenuOpen}
              onClick={() => setAvatarMenuOpen((v) => !v)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <UserAvatar email={user.email} avatarUrl={user.avatarUrl} size={28} />
            </button>

            {avatarMenuOpen && (
              <>
                {/* Backdrop: fecha ao clicar fora. Fica ATRÁS do botão do
                    avatar (que está num elemento posterior no DOM/mesmo
                    z-index padrão), então clicar no próprio botão não conta
                    como "fora" — o onClick do botão já cuida de alternar. */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAvatarMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-border bg-surface p-3 shadow-lg">
                  <AvatarUpload />
                </div>
              </>
            )}
          </div>
        )}
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
