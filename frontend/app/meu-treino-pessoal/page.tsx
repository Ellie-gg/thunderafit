"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listSelfTemplates, applySelfTemplate } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

/**
 * Fase 34.5 — "Meu treino pessoal": templates curados pelo admin (origin:
 * SELF), sem Personal nenhum envolvido. O aluno só escolhe e aplica (cópia,
 * mesmo padrão de sempre) — sem acesso ao catálogo completo de exercícios
 * nem montagem livre nesta fase. "Crie seu treino do zero" é só um
 * placeholder visual ("em breve"): não decidimos ainda se vira feature paga.
 */
function MeuTreinoPessoalContent() {
  const t = useTranslations("meuTreinoPessoal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const templatesQuery = useQuery({ queryKey: ["self-templates"], queryFn: listSelfTemplates });

  const applyMutation = useMutation({
    mutationFn: (programId: string) => applySelfTemplate(programId),
    onSuccess: (data) => {
      router.push(`/programas/${data.program.id}`);
    },
  });

  const templates = templatesQuery.data?.programs ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        {templatesQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {templatesQuery.isError && (
          <QueryError error={templatesQuery.error} onRetry={() => templatesQuery.refetch()} />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-bold">{tpl.name}</h2>
              <p className="text-xs text-muted">
                {t("sessionCountScheme", {
                  count: tpl.workouts?.length ?? 0,
                  scheme:
                    tpl.sessionScheme === "WEEKDAY" ? t("schemeWeekday") : t("schemeLetter"),
                })}
              </p>
              <Button
                className="mt-2"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate(tpl.id)}
              >
                {applyMutation.isPending ? t("applying") : t("applyTemplate")}
              </Button>
            </Card>
          ))}
        </div>

        {templatesQuery.isSuccess && templates.length === 0 && (
          <p className="text-sm text-muted">{t("emptyState")}</p>
        )}

        {applyMutation.isError && (
          <p className="text-sm text-danger">
            {applyMutation.error instanceof ApiError
              ? applyMutation.error.message
              : t("applyError")}
          </p>
        )}

        {/* Placeholder visual — sem lógica por trás, "em breve". Não decide
            ainda se vira feature paga (ver STATUS.md, Fase 34.5). */}
        <Card className="flex flex-col gap-2 border-dashed opacity-70">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">{t("buildFromScratch")}</h2>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted">
              {t("comingSoon")}
            </span>
          </div>
          <p className="text-sm text-muted">{t("buildFromScratchDescription")}</p>
          <Button type="button" disabled>
            {t("comingSoon")}
          </Button>
        </Card>

        <p className="text-center text-sm text-muted">
          {t("wantCloserFollowUp")}{" "}
          <Link href="/profissionais" className="font-semibold text-accent-secondary hover:underline">
            {t("invitePersonal")}
          </Link>
          .
        </p>
      </main>
    </>
  );
}

export default function MeuTreinoPessoalPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <MeuTreinoPessoalContent />
    </AuthGuard>
  );
}
