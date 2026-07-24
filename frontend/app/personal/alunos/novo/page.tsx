"use client";

import { useTranslations } from "next-intl";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { VincularAlunoForm } from "@/components/vincular-aluno-form";

function VincularAlunoContent() {
  const t = useTranslations("personalVincularAluno");
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <VincularAlunoForm dashboardPath="/personal/dashboard" professionalLabel={t("professionalLabel")} />
      </main>
    </>
  );
}

export default function VincularAlunoPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <VincularAlunoContent />
    </AuthGuard>
  );
}
