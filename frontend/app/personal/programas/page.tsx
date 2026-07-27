"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listWorkoutPrograms,
  createWorkoutProgram,
  listPersonalCatalog,
  applyCatalogTemplate,
} from "@/lib/api/workouts";
import { listRelations } from "@/lib/api/relations";
import { getBillingStatus } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";
import type { SessionScheme, WorkoutProgram } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { DeleteProgramButton } from "@/components/delete-program-button";
import { SelfTemplateCarousel } from "@/components/self-template-carousel";
import { TemplatePreviewDialog } from "@/components/template-preview-dialog";

function ProgramasPersonalContent() {
  const t = useTranslations("personalProgramasList");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal"],
    queryFn: () => listWorkoutPrograms(),
  });
  // Fase 25: alvo é só um atalho de UI — pré-preenche o select de "Aplicar a
  // um aluno" na tela do programa recém-criado. O programa em si sempre nasce
  // como template puro (isTemplate=true, sem aluno), igual já era; aplicar
  // continua sendo um passo explícito depois de montar as sessões.
  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });
  const [name, setName] = useState("");
  const [targetAlunoId, setTargetAlunoId] = useState("");
  const [sessionScheme, setSessionScheme] = useState<SessionScheme>("LETTER");

  // Fase 62: catálogo Básico (gratuito, curado pelo admin) + Premium
  // (reaproveita os templates SELF/PREMIUM já vendidos pro aluno).
  const catalogQuery = useQuery({
    queryKey: ["workout-programs", "personal-catalog"],
    queryFn: listPersonalCatalog,
  });
  const billingQuery = useQuery({ queryKey: ["billing-status"], queryFn: getBillingStatus });
  const isPlus = billingQuery.data?.planoAssinatura === "PLUS";
  const [previewTemplate, setPreviewTemplate] = useState<WorkoutProgram | null>(null);

  const applyCatalogMutation = useMutation({
    mutationFn: (vars: { programId: string; alunoId: string }) =>
      applyCatalogTemplate(vars.programId, vars.alunoId),
    onSuccess: () => {
      setPreviewTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createWorkoutProgram(name.trim(), sessionScheme),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] });
      const query = targetAlunoId ? `?alunoId=${targetAlunoId}` : "";
      router.push(`/personal/programas/${data.program.id}${query}`);
    },
  });

  const programs = programsQuery.data?.programs ?? [];
  const templates = programs.filter((p) => p.isTemplate);
  const catalogPrograms = catalogQuery.data?.programs ?? [];
  const basicoTemplates = catalogPrograms.filter((p) => p.tier === "BASICO");
  const premiumTemplates = catalogPrograms.filter((p) => p.tier === "PREMIUM");

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">{t("newProgramTitle")}</h2>
          <p className="text-xs text-muted">{t("newProgramDescription")}</p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t("programNameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("programNamePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("sessionNamingLabel")}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSessionScheme("LETTER")}
                  aria-pressed={sessionScheme === "LETTER"}
                  className={
                    sessionScheme === "LETTER"
                      ? "flex-1 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
                      : "flex-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:border-accent"
                  }
                >
                  {t("letterScheme")}
                </button>
                <button
                  type="button"
                  onClick={() => setSessionScheme("WEEKDAY")}
                  aria-pressed={sessionScheme === "WEEKDAY"}
                  className={
                    sessionScheme === "WEEKDAY"
                      ? "flex-1 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
                      : "flex-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:border-accent"
                  }
                >
                  {t("weekdayScheme")}
                </button>
              </div>
              <p className="text-xs text-muted">
                {sessionScheme === "WEEKDAY" ? t("upTo7Sessions") : t("upTo5Sessions")}{" "}
                {t("chooseHowMany")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetAluno">{t("targetAlunoLabel")}</Label>
              <select
                id="targetAluno"
                value={targetAlunoId}
                onChange={(e) => setTargetAlunoId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">{t("pureTemplateOption")}</option>
                {relationsQuery.data?.relations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">{t("targetAlunoHint")}</p>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-danger">
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : t("createProgramError")}
              </p>
            )}
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? t("creating") : t("createProgram")}
            </Button>
          </form>
        </Card>

        {programsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">
            {t("templatesTitle", { count: templates.length })}
          </h2>
          {templates.length === 0 && (
            <p className="text-sm text-muted">{t("noTemplatesYet")}</p>
          )}
          {templates.map((p) => (
            <Link key={p.id} href={`/personal/programas/${p.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <p className="text-xs text-muted">
                    {t("sessionsCount", { count: p.workouts?.length ?? 0 })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DeleteProgramButton
                    programId={p.id}
                    isTemplate
                    onDeleted={() =>
                      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] })
                    }
                  />
                  <span className="text-sm text-muted">{t("open")}</span>
                </div>
              </Card>
            </Link>
          ))}
        </section>

        {/* Fase 62: catálogo Básico — gratuito, curado pelo admin, disponível
            pra todo Personal. */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("basicoTitle")}</h2>
            <p className="text-sm text-muted">{t("basicoSubtitle")}</p>
          </div>
          {catalogQuery.isSuccess && basicoTemplates.length === 0 && (
            <p className="text-sm text-muted">{t("catalogEmpty")}</p>
          )}
          <SelfTemplateCarousel templates={basicoTemplates} onSelect={setPreviewTemplate} />
        </section>

        {/* Fase 62: catálogo Premium — reaproveita os mesmos templates
            origin: SELF, category: PREMIUM já vendidos pro aluno como "Aluno
            Premium" (Fase 57/60); exige plano Plus do Personal. */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("premiumTitle")}</h2>
            <p className="text-sm text-muted">{t("premiumSubtitle")}</p>
          </div>
          {catalogQuery.isSuccess && premiumTemplates.length === 0 && (
            <p className="text-sm text-muted">{t("catalogEmpty")}</p>
          )}
          <SelfTemplateCarousel
            templates={premiumTemplates}
            locked={!isPlus}
            onSelect={(tpl) => {
              // Sem plano Plus, nem abre o preview — vai direto pra tela de
              // compra (mesmo comportamento do cadeado do aluno gratuito:
              // clicar num template pago não deixa ver/tentar aplicar antes
              // de resolver o acesso). `?from=templates` deixa a tela de
              // upgrade destacar especificamente qual plano libera os
              // templates, em vez do texto genérico de sempre.
              if (!isPlus) {
                router.push("/personal/upgrade?from=templates");
                return;
              }
              setPreviewTemplate(tpl);
            }}
          />
          {!isPlus && premiumTemplates.length > 0 && (
            <Card className="flex flex-col gap-2">
              <p className="text-sm text-muted">{t("premiumUpgradePitch")}</p>
              <Button asChild variant="secondary">
                <Link href="/personal/upgrade?from=templates">{t("premiumUpgradeButton")}</Link>
              </Button>
            </Card>
          )}
        </section>
      </main>

      {previewTemplate && (
        <TemplatePreviewDialog
          template={previewTemplate}
          alunoOptions={relationsQuery.data?.relations ?? []}
          onApplyToAluno={(alunoId) =>
            applyCatalogMutation.mutate({ programId: previewTemplate.id, alunoId })
          }
          onCancel={() => setPreviewTemplate(null)}
        />
      )}
      {applyCatalogMutation.isError && (
        <p className="px-6 text-sm text-danger">
          {applyCatalogMutation.error instanceof ApiError
            ? applyCatalogMutation.error.message
            : t("catalogApplyError")}
        </p>
      )}
    </>
  );
}

export default function ProgramasPersonalPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL", "NUTRICIONISTA"]}>
      <ProgramasPersonalContent />
    </AuthGuard>
  );
}
