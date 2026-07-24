"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listThreads } from "@/lib/api/support";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { QueryError } from "@/components/query-error";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("nutricionistaDuvidasList");
  const isRespondido = status === "RESPONDIDO";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        isRespondido ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
      }`}
    >
      {isRespondido ? t("status.respondido") : t("status.aberto")}
    </span>
  );
}

function NutricionistaDuvidasContent() {
  const t = useTranslations("nutricionistaDuvidasList");
  const tCommon = useTranslations("common");
  const [filter, setFilter] = useState<"ABERTO" | "RESPONDIDO" | "TODAS">("ABERTO");
  const threadsQuery = useQuery({ queryKey: ["support-threads"], queryFn: listThreads });

  const threads = (threadsQuery.data?.threads ?? []).filter(
    (thread) => filter === "TODAS" || thread.status === filter
  );

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant={filter === "ABERTO" ? "default" : "secondary"} onClick={() => setFilter("ABERTO")}>
            {t("filterAbertas")}
          </Button>
          <Button size="sm" variant={filter === "RESPONDIDO" ? "default" : "secondary"} onClick={() => setFilter("RESPONDIDO")}>
            {t("filterRespondidas")}
          </Button>
          <Button size="sm" variant={filter === "TODAS" ? "default" : "secondary"} onClick={() => setFilter("TODAS")}>
            {t("filterTodas")}
          </Button>
        </div>

        {threadsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {threadsQuery.isError && (
          <QueryError error={threadsQuery.error} onRetry={() => threadsQuery.refetch()} />
        )}
        {threadsQuery.isSuccess && threads.length === 0 && (
          <Card>
            <p className="text-sm text-muted">{t("nenhumaDuvida")}</p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {threads.map((thread) => (
            <Link key={thread.id} href={`/nutricionista/duvidas/${thread.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <p className="font-semibold">{thread.subject}</p>
                  <p className="text-xs text-muted">
                    {thread.messages[0]?.text.slice(0, 60)}
                    {(thread.messages[0]?.text.length ?? 0) > 60 ? t("truncationEllipsis") : ""}
                  </p>
                </div>
                <StatusBadge status={thread.status} />
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export default function NutricionistaDuvidasPage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <NutricionistaDuvidasContent />
    </AuthGuard>
  );
}
