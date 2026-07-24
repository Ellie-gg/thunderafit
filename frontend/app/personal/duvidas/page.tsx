"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listThreads } from "@/lib/api/support";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { QueryError } from "@/components/query-error";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("personalDuvidasList");
  const isRespondido = status === "RESPONDIDO";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        isRespondido ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
      }`}
    >
      {isRespondido ? t("respondido") : t("aberto")}
    </span>
  );
}

function PersonalDuvidasContent() {
  const t = useTranslations("personalDuvidasList");
  const tc = useTranslations("common");
  const [filter, setFilter] = useState<"ABERTO" | "RESPONDIDO" | "TODAS">("ABERTO");
  const threadsQuery = useQuery({ queryKey: ["support-threads"], queryFn: listThreads });

  const threads = (threadsQuery.data?.threads ?? []).filter(
    (t) => filter === "TODAS" || t.status === filter
  );

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-muted">{t("subtitulo")}</p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "ABERTO" ? "default" : "secondary"}
            onClick={() => setFilter("ABERTO")}
          >
            {t("abertas")}
          </Button>
          <Button
            size="sm"
            variant={filter === "RESPONDIDO" ? "default" : "secondary"}
            onClick={() => setFilter("RESPONDIDO")}
          >
            {t("respondidas")}
          </Button>
          <Button
            size="sm"
            variant={filter === "TODAS" ? "default" : "secondary"}
            onClick={() => setFilter("TODAS")}
          >
            {t("todas")}
          </Button>
        </div>

        {threadsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}

        {threadsQuery.isError && (
          <QueryError error={threadsQuery.error} onRetry={() => threadsQuery.refetch()} />
        )}

        {threadsQuery.isSuccess && threads.length === 0 && (
          <Card>
            <p className="text-sm text-muted">{t("nenhumaDuvida")}</p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {threads.map((t) => (
            <Link key={t.id} href={`/personal/duvidas/${t.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.messages[0]?.text.slice(0, 60)}
                    {(t.messages[0]?.text.length ?? 0) > 60 ? "..." : ""}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export default function PersonalDuvidasPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <PersonalDuvidasContent />
    </AuthGuard>
  );
}
