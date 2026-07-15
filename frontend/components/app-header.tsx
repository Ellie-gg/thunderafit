"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { logoutRequest } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const router = useRouter();
  const { user, clearSession } = useAuthStore();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          ⚡
        </span>
        <span className="font-display text-sm font-bold tracking-tight">ThunderaFit</span>
      </Link>

      <div className="flex items-center gap-3">
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
