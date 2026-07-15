"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { onAuthExpired } from "@/lib/api/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
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
    if (isHydrated && !user) {
      router.replace("/login");
    }
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">Carregando...</span>
      </div>
    );
  }

  return <>{children}</>;
}
