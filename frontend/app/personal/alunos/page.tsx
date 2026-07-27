"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listRelations } from "@/lib/api/relations";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { useTranslations } from "next-intl";

/**
 * Fase 62 — "Gerenciar alunos": a lista completa de alunos vinculados saiu
 * do dashboard (que agora só mostra a contagem/limite) e ganhou uma tela
 * própria, com um selo de "sem treino aplicado" por aluno — a mesma
 * visibilidade que a lista antiga do dashboard dava, sem poluir a tela
 * principal. Cada card abre o hub já existente (`/personal/alunos/[id]`),
 * sem mudança nenhuma ali.
 */
function GerenciarAlunosContent() {
  const t = useTranslations("personalAlunosList");
  const tc = useTranslations("common");
  const intlLocale = useActiveIntlLocale();

  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal"],
    queryFn: () => listWorkoutPrograms(),
  });

  const alunos = relationsQuery.data?.relations ?? [];
  const alunoIdsComTreino = new Set(
    (programsQuery.data?.programs ?? []).filter((p) => !p.isTemplate && p.alunoId).map((p) => p.alunoId)
  );

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-muted">{t("subtitulo")}</p>
        </div>

        {relationsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
        {relationsQuery.isError && (
          <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
        )}

        <div className="flex flex-col gap-2">
          {alunos.map((a) => (
            <Link key={a.id} href={`/personal/alunos/${a.id}`}>
              <Card className="flex items-center justify-between gap-3 transition-colors hover:border-accent">
                {/* min-w-0 + break-all: sem isso, um e-mail longo não quebra
                    linha e empurra o grupo da direita pra fora do card. */}
                <div className="min-w-0 flex-1">
                  <span className="block truncate break-all text-sm font-semibold">{a.email}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">
                      {t("desde", { data: new Date(a.createdAt).toLocaleDateString(intlLocale) })}
                    </span>
                    {!alunoIdsComTreino.has(a.id) && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {t("semTreino")}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm text-muted">{t("gerenciar")}</span>
              </Card>
            </Link>
          ))}
          {relationsQuery.isSuccess && alunos.length === 0 && (
            <p className="text-sm text-muted">{t("nenhumAlunoVinculado")}</p>
          )}
        </div>
      </main>
    </>
  );
}

export default function GerenciarAlunosPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <GerenciarAlunosContent />
    </AuthGuard>
  );
}
