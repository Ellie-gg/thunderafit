"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";

/**
 * Fase 24 (Parte 2): a seleção de papel Personal/Aluno saiu daqui — agora
 * acontece dentro do fluxo unificado de e-mail em /login (cadastro pede o
 * papel só depois de check-email confirmar que o e-mail é novo). Esta tela
 * só decide para onde mandar: sessão existente → dashboard; sem sessão →
 * /login.
 */
export default function Home() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    router.replace(user ? dashboardPathForRole(user.role) : "/login");
  }, [isHydrated, user, router]);

  return null;
}
