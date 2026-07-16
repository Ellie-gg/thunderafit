"use client";

import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { SupportThreadDetail } from "@/components/support-thread-detail";

function DuvidaDetailContent() {
  const params = useParams<{ id: string }>();
  return <SupportThreadDetail threadId={params.id} backHref="/duvidas" />;
}

export default function DuvidaDetailPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <AppHeader />
      <DuvidaDetailContent />
    </AuthGuard>
  );
}
