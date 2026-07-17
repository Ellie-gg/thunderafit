"use client";

import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { SupportThreadDetail } from "@/components/support-thread-detail";

function NutricionistaDuvidaDetailContent() {
  const params = useParams<{ id: string }>();
  return <SupportThreadDetail threadId={params.id} backHref="/nutricionista/duvidas" />;
}

export default function NutricionistaDuvidaDetailPage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <AppHeader />
      <NutricionistaDuvidaDetailContent />
    </AuthGuard>
  );
}
