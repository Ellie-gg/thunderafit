"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { VincularAlunoForm } from "@/components/vincular-aluno-form";

function VincularAlunoContent() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <VincularAlunoForm dashboardPath="/nutricionista/dashboard" professionalLabel="Nutricionista" />
      </main>
    </>
  );
}

export default function VincularAlunoPage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <VincularAlunoContent />
    </AuthGuard>
  );
}
