"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSelfTemplates, applySelfTemplate } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import type { WorkoutProgram } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { SelfTemplateCarousel } from "@/components/self-template-carousel";
import { ReplaceSelfTemplateDialog } from "@/components/replace-self-template-dialog";

/**
 * Fase 34.5 — "Meu treino pessoal": templates curados pelo admin (origin:
 * SELF), sem Personal nenhum envolvido. O aluno só escolhe e aplica (cópia,
 * mesmo padrão de sempre) — sem acesso ao catálogo completo de exercícios
 * nem montagem livre nesta fase.
 *
 * Fase 52: além da lista plana (categoria GERAL, comportamento inalterado),
 * carrosséis novos agrupados por `category` — "Treino em Casa" (HOME,
 * funcional: aplica de verdade, com fluxo de confirmação de troca via 409
 * SELF_PROGRAM_EXISTS) e "Treinos Premium" (PREMIUM, decorativo: todo slide
 * tem cadeado e o clique só mostra "em breve", sem chamar a API — não existe
 * conceito de aluno pagante ainda).
 *
 * Fase 54: "Crie seu treino do zero" (placeholder inerte, "em breve") foi
 * REMOVIDO — no lugar dele entra "Treinos Prontos" (PRONTOS), mesmo
 * carrossel/banner de HOME, também totalmente funcional (sem cadeado,
 * gratuito) — templates de academia (aparelhos/polias/halteres/barra)
 * disponibilizados pelo fundador.
 */
function MeuTreinoPessoalContent() {
  const t = useTranslations("meuTreinoPessoal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const templatesQuery = useQuery({ queryKey: ["self-templates"], queryFn: listSelfTemplates });

  const applyMutation = useMutation({
    mutationFn: (programId: string) => applySelfTemplate(programId),
    onSuccess: (data) => {
      router.push(`/programas/${data.program.id}`);
    },
  });

  // Fluxo de aplicação do carrossel "Treino em Casa": diferente do
  // applyMutation da lista plana porque precisa distinguir "409 por já ter
  // um treino pessoal ativo" (abre diálogo de confirmação) de qualquer outro
  // erro (mostra mensagem, igual applyMutation já faz).
  const [pendingReplace, setPendingReplace] = React.useState<{
    template: WorkoutProgram;
    existingProgramName: string;
  } | null>(null);
  const [premiumNotice, setPremiumNotice] = React.useState(false);

  function onApplySuccess(data: { program: WorkoutProgram }) {
    queryClient.invalidateQueries({ queryKey: ["self-templates"] });
    router.push(`/programas/${data.program.id}`);
  }

  const homeApplyMutation = useMutation({
    mutationFn: (programId: string) => applySelfTemplate(programId),
    onSuccess: onApplySuccess,
    onError: (error, programId) => {
      if (error instanceof ApiError && error.status === 409 && error.data?.code === "SELF_PROGRAM_EXISTS") {
        const template = homeTemplates.find((tpl) => tpl.id === programId);
        if (template) {
          setPendingReplace({
            template,
            existingProgramName: String(error.data.existingProgramName ?? ""),
          });
        }
      }
    },
  });

  // Fase 54: mesmo fluxo funcional do carrossel "Treino em Casa" (aplica de
  // verdade, mesma trava de "1 treino pessoal ativo por vez" com diálogo de
  // confirmação de troca) — mutation própria só pra procurar o template na
  // lista certa (prontosTemplates) quando o 409 acontece.
  const prontosApplyMutation = useMutation({
    mutationFn: (programId: string) => applySelfTemplate(programId),
    onSuccess: onApplySuccess,
    onError: (error, programId) => {
      if (error instanceof ApiError && error.status === 409 && error.data?.code === "SELF_PROGRAM_EXISTS") {
        const template = prontosTemplates.find((tpl) => tpl.id === programId);
        if (template) {
          setPendingReplace({
            template,
            existingProgramName: String(error.data.existingProgramName ?? ""),
          });
        }
      }
    },
  });

  const replaceMutation = useMutation({
    mutationFn: (programId: string) => applySelfTemplate(programId, true),
    onSuccess: (data) => {
      setPendingReplace(null);
      onApplySuccess(data);
    },
  });

  const templates = templatesQuery.data?.programs ?? [];
  const geralTemplates = templates.filter((tpl) => tpl.category === "GERAL");
  const prontosTemplates = templates.filter((tpl) => tpl.category === "PRONTOS");
  const homeTemplates = templates.filter((tpl) => tpl.category === "HOME");
  const premiumTemplates = templates.filter((tpl) => tpl.category === "PREMIUM");

  function handleSelectProntos(template: WorkoutProgram) {
    setPremiumNotice(false);
    prontosApplyMutation.mutate(template.id);
  }

  function handleSelectHome(template: WorkoutProgram) {
    setPremiumNotice(false);
    homeApplyMutation.mutate(template.id);
  }

  function handleSelectPremium() {
    setPremiumNotice(true);
  }

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
          {geralTemplates.map((tpl) => (
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

        {templatesQuery.isSuccess && geralTemplates.length === 0 && (
          <p className="text-sm text-muted">{t("emptyState")}</p>
        )}

        {applyMutation.isError && (
          <p className="text-sm text-danger">
            {applyMutation.error instanceof ApiError
              ? applyMutation.error.message
              : t("applyError")}
          </p>
        )}

        {/* Fase 54: "Treinos Prontos" — carrossel funcional, substitui o
            antigo card estático "Crie seu treino do zero". */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("prontosSectionTitle")}</h2>
            <p className="text-sm text-muted">{t("prontosSectionSubtitle")}</p>
          </div>
          {templatesQuery.isSuccess && prontosTemplates.length === 0 && (
            <p className="text-sm text-muted">{t("emptyState")}</p>
          )}
          <SelfTemplateCarousel templates={prontosTemplates} onSelect={handleSelectProntos} />
          {prontosApplyMutation.isError &&
            !(
              prontosApplyMutation.error instanceof ApiError &&
              prontosApplyMutation.error.status === 409 &&
              prontosApplyMutation.error.data?.code === "SELF_PROGRAM_EXISTS"
            ) && (
              <p className="text-sm text-danger">
                {prontosApplyMutation.error instanceof ApiError
                  ? prontosApplyMutation.error.message
                  : t("applyError")}
              </p>
            )}
        </div>

        {/* Fase 52: "Treino em Casa" — carrossel funcional. */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("homeSectionTitle")}</h2>
            <p className="text-sm text-muted">{t("homeSectionSubtitle")}</p>
          </div>
          {templatesQuery.isSuccess && homeTemplates.length === 0 && (
            <p className="text-sm text-muted">{t("emptyState")}</p>
          )}
          <SelfTemplateCarousel templates={homeTemplates} onSelect={handleSelectHome} />
          {homeApplyMutation.isError &&
            !(
              homeApplyMutation.error instanceof ApiError &&
              homeApplyMutation.error.status === 409 &&
              homeApplyMutation.error.data?.code === "SELF_PROGRAM_EXISTS"
            ) && (
              <p className="text-sm text-danger">
                {homeApplyMutation.error instanceof ApiError
                  ? homeApplyMutation.error.message
                  : t("applyError")}
              </p>
            )}
        </div>

        {/* Fase 52: "Treinos Premium" — decorativo, todo slide bloqueado. */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("premiumSectionTitle")}</h2>
            <p className="text-sm text-muted">{t("premiumSectionSubtitle")}</p>
          </div>
          {templatesQuery.isSuccess && premiumTemplates.length === 0 && (
            <p className="text-sm text-muted">{t("emptyState")}</p>
          )}
          <SelfTemplateCarousel templates={premiumTemplates} locked onSelect={handleSelectPremium} />
          {premiumNotice && <p className="text-sm text-muted">{t("premiumComingSoon")}</p>}
        </div>

        <p className="text-center text-sm text-muted">
          {t("wantCloserFollowUp")}{" "}
          <Link href="/profissionais" className="font-semibold text-accent-secondary hover:underline">
            {t("invitePersonal")}
          </Link>
          .
        </p>
      </main>

      {pendingReplace && (
        <ReplaceSelfTemplateDialog
          existingProgramName={pendingReplace.existingProgramName}
          isPending={replaceMutation.isPending}
          onCancel={() => setPendingReplace(null)}
          onConfirm={() => replaceMutation.mutate(pendingReplace.template.id)}
        />
      )}
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
