"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { onAuthExpired } from "@/lib/api/client";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import type { Role } from "@/lib/types";

export function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  /** Se omitido, qualquer role autenticada acessa. */
  allowedRoles?: Role[];
}) {
  const router = useRouter();
  const { user, isHydrated, hydrate, clearSession } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    // O JS não consegue inspecionar o cookie httpOnly — se um fetch autenticado
    // falhar mesmo após tentar refresh, é o sinal de que a sessão morreu.
    onAuthExpired(() => {
      clearSession();
      router.replace("/login");
    });
  }, [clearSession, router]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Usuário autenticado, mas na área errada (ex: aluno em /personal/*) —
      // manda para o próprio dashboard em vez de um 403 seco.
      router.replace(dashboardPathForRole(user.role));
    }
  }, [isHydrated, user, router, allowedRoles]);

  const isAuthorized = user && (!allowedRoles || allowedRoles.includes(user.role));

  if (!isHydrated || !isAuthorized) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">Carregando...</span>
      </div>
    );
  }

  return <>{children}</>;
}
