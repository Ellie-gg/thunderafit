"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listMyDietPlans } from "@/lib/api/nutrition";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

function NutricionistaDashboardContent() {
  const t = useTranslations("nutricionistaDashboard");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const user = useAuthStore((s) => s.user);

  const relationsQuery = useQuery({
    queryKey: ["relations"],
    queryFn: listRelations,
  });

  const plansQuery = useQuery({
    queryKey: ["diet-plans"],
    queryFn: listMyDietPlans,
  });

  const alunos = relationsQuery.data?.relations ?? [];
  const limite = user?.limiteAlunos ?? 0;
  const noLimite = alunos.length >= limite;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("greeting", { name: user?.email.split("@")[0] ?? "" })}
          </h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("alunosVinculados")}
            </span>
            <span className="font-mono-nums text-xs text-muted">
              {alunos.length}/{limite}
            </span>
          </div>
          <VoltageBar total={limite} filled={alunos.length} role="NUTRICIONISTA" />

          {noLimite && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {t("limiteAtingidoMsg")}
            </p>
          )}

          {relationsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

          {relationsQuery.isError && (
            <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {alunos.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{a.email}</span>
                <div className="flex items-center gap-3">
                  {/* Fase 17 (Item 6): Nutricionista pode ver (leitura) a
                      anamnese do aluno vinculado. */}
                  <Link
                    href={`/nutricionista/alunos/${a.id}/anamnese`}
                    className="text-xs font-semibold text-accent-secondary hover:underline"
                  >
                    {t("anamneseLink")}
                  </Link>
                  <span className="text-xs text-muted">
                    {t("desde", { date: new Date(a.createdAt).toLocaleDateString(intlLocale) })}
                  </span>
                </div>
              </div>
            ))}
            {relationsQuery.isSuccess && alunos.length === 0 && (
              <p className="text-sm text-muted">{t("nenhumAluno")}</p>
            )}
          </div>

          <Button asChild variant={noLimite ? "secondary" : "default"} disabled={noLimite}>
            <Link href={noLimite ? "#" : "/nutricionista/alunos/novo"}>
              {noLimite ? t("limiteAtingidoBtn") : t("vincularNovoAluno")}
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("planosDietaPrescritos")}
            </span>
          </div>

          {plansQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

          {plansQuery.isError && (
            <QueryError error={plansQuery.error} onRetry={() => plansQuery.refetch()} />
          )}

          <div className="flex flex-col gap-2">
            {plansQuery.data?.plans.map((p) => (
              <Link key={p.id} href={`/nutricionista/planos/${p.id}`}>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-accent">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">{t("ver")}</span>
                </div>
              </Link>
            ))}
            {plansQuery.isSuccess && plansQuery.data.plans.length === 0 && (
              <p className="text-sm text-muted">{t("nenhumPlano")}</p>
            )}
          </div>

          <Button asChild variant="secondary" disabled={alunos.length === 0}>
            <Link href={alunos.length === 0 ? "#" : "/nutricionista/planos/novo"}>
              {t("criarNovoPlano")}
            </Link>
          </Button>
        </Card>
      </main>
    </>
  );
}

export default function NutricionistaDashboardPage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <NutricionistaDashboardContent />
    </AuthGuard>
  );
}
