"use client";

import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { SupportThreadDetail } from "@/components/support-thread-detail";

function PersonalDuvidaDetailContent() {
  const params = useParams<{ id: string }>();
  return <SupportThreadDetail threadId={params.id} backHref="/personal/duvidas" />;
}

export default function PersonalDuvidaDetailPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <AppHeader />
      <PersonalDuvidaDetailContent />
    </AuthGuard>
  );
}
