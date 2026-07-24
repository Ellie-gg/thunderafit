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

type NavLink = { href: string; label: string };

// Fase 33.2: fonte única dos links por papel — antes só existiam como
// `hidden ... sm:inline` no header, então no celular (a maioria do uso real,
// segundo o fundador) não havia NENHUM jeito de navegar entre as seções
// (Programas/Evolução/Anamnese/etc) além do botão voltar do navegador. Os
// mesmos itens agora alimentam a barra desktop (`sm:flex`, texto inline) E o
// menu hambúrguer mobile (visível só abaixo de `sm`).
const NAV_LINKS_BY_ROLE: Record<Role, NavLink[]> = {
  ALUNO: [
    { href: "/programas", label: "Programas" },
    { href: "/meu-treino-pessoal", label: "Meu Treino Pessoal" },
    { href: "/evolucao", label: "Evolução" },
    { href: "/anamnese", label: "Anamnese" },
    { href: "/duvidas", label: "Dúvidas" },
    { href: "/profissionais", label: "Encontrar Personal" },
    { href: "/perfil", label: "Perfil" },
  ],
  PERSONAL: [
    { href: "/personal/programas", label: "Programas" },
    { href: "/personal/solicitacoes", label: "Solicitações" },
    { href: "/personal/duvidas", label: "Dúvidas" },
    { href: "/personal/upgrade", label: "Planos" },
    { href: "/personal/perfil", label: "Perfil" },
  ],
  NUTRICIONISTA: [{ href: "/nutricionista/duvidas", label: "Dúvidas" }],
  ADMIN: [
    { href: "/nimbus/usuarios", label: "Usuários" },
    { href: "/nimbus/exercicios", label: "Exercícios" },
    { href: "/nimbus/treinos-pessoais", label: "Treinos Pessoais" },
    { href: "/nimbus/logins", label: "Logins" },
    { href: "/nimbus/suporte", label: "Suporte" },
    { href: "/nimbus/logs-acesso", label: "Logs de acesso" },
  ],
};

export function AppHeader() {
  const router = useRouter();
  const { user, clearSession } = useAuthStore();
  // Fase 31: o link "Perfil" só aparecia a partir do breakpoint sm — no
  // celular não havia NENHUM jeito de chegar em /perfil pra trocar a foto.
  // O ícone circular vira o ponto de entrada em qualquer largura de tela.
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  // Fase 33.2: mesmo problema do avatar (Fase 31), só que pra TODOS os links
  // de navegação — "Programas", "Evolução", "Anamnese" etc eram só
  // `sm:inline`, então no celular não existia nenhum jeito de navegar entre
  // seções (só o botão voltar do navegador). Menu hambúrguer visível abaixo
  // de `sm` resolve pra todos os papéis de uma vez.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = user ? NAV_LINKS_BY_ROLE[user.role] : [];

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
            mal ao lado do sino e do botão Sair; no mobile o menu hambúrguer
            abaixo cobre os mesmos itens. */}
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hidden text-sm font-semibold text-accent-secondary hover:underline sm:inline"
          >
            {link.label}
          </Link>
        ))}
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
        {navLinks.length > 0 && (
          <div className="relative sm:hidden">
            <button
              type="button"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span aria-hidden className="text-lg leading-none">
                ☰
              </span>
            </button>

            {mobileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-hidden
                />
                <nav className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col gap-1 rounded-md border border-border bg-surface p-2 shadow-lg">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-md px-3 py-2 text-sm font-semibold text-accent-secondary hover:bg-surface-raised"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </div>
        )}
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
