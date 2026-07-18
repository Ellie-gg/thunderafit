"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { AvatarUpload } from "@/components/avatar-upload";

/**
 * Fase 30: tela mínima de perfil do aluno — só a foto por enquanto (o
 * Personal já tinha /personal/perfil pra bio/localização; o aluno não tinha
 * nenhuma tela de perfil própria). Fica como ponto natural de extensão pra
 * futuras preferências do aluno, sem precisar de rota nova.
 */
function PerfilContent() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            Perfil
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Meu perfil</h1>
        </div>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold">Foto de perfil</h2>
          <AvatarUpload />
        </Card>
      </main>
    </>
  );
}

export default function PerfilPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <PerfilContent />
    </AuthGuard>
  );
}
