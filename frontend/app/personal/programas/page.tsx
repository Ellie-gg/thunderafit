"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { SessionScheme, WorkoutProgram, WorkoutTag } from "@/lib/types";
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
import { GenerateWorkoutModal } from "@/components/generate-workout-modal";

// Fase 72: filtro rápido por chip nos catálogos Premium/Básico — mesmo
// padrão do carrossel "Treinos Premium" do aluno (Fase 63), agora com os 3
// níveis (Fase 70) além das tags de foco.
// Fase 74: multi-seleção — o Personal pode marcar 2+ tags ao mesmo tempo
// (um template aparece se tiver QUALQUER uma das tags marcadas, "OU" entre
// elas); "TODOS" é só o atalho pra limpar a seleção, não é uma tag real.
const TAG_FILTERS: WorkoutTag[] = [
  "FEMININO",
  "HIPERTROFIA",
  "DEFINICAO",
  "EXPRESS",
  "INICIANTE",
  "INTERMEDIARIO",
  "AVANCADO",
];
// Tom levemente diferente pras 3 tags de nível — mesma lista de chips, mas
// dá pra distinguir "foco" de "nível" só olhando a cor.
const LEVEL_TAGS = new Set<WorkoutTag>(["INICIANTE", "INTERMEDIARIO", "AVANCADO"]);

function TagFilterChips({
  selected,
  onToggle,
  onClear,
  t,
}: {
  selected: Set<WorkoutTag>;
  onToggle: (tag: WorkoutTag) => void;
  onClear: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selected.size === 0}
        onClick={onClear}
        className={
          selected.size === 0
            ? "rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
            : "rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent"
        }
      >
        {t("tagFilter.TODOS")}
      </button>
      {TAG_FILTERS.map((tag) => {
        const isLevel = LEVEL_TAGS.has(tag);
        const isSelected = selected.has(tag);
        const className = isSelected
          ? isLevel
            ? "rounded-full border border-accent-secondary bg-accent-secondary/10 px-3 py-1.5 text-xs font-semibold text-accent-secondary"
            : "rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
          : isLevel
            ? "rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent-secondary"
            : "rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent";
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(tag)}
            className={className}
          >
            {t(`tagFilter.${tag}`)}
          </button>
        );
      })}
    </div>
  );
}

function toggleTagInSet(set: Set<WorkoutTag>, tag: WorkoutTag): Set<WorkoutTag> {
  const next = new Set(set);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  return next;
}

function ProgramasPersonalContent() {
  const t = useTranslations("personalProgramasList");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // Fase 66: "Explorar Templates" do dashboard já chega aqui mostrando as
  // listas; "+ Criar treino do zero" chega com `?criar=1` pra abrir direto o
  // formulário, que agora vive escondido atrás de um botão em vez de sempre
  // visível no topo da tela.
  const [showCreateForm, setShowCreateForm] = useState(searchParams.get("criar") === "1");
  const [generatorOpen, setGeneratorOpen] = useState(false);
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
  const [premiumTagFilter, setPremiumTagFilter] = useState<Set<WorkoutTag>>(new Set());
  const [basicoTagFilter, setBasicoTagFilter] = useState<Set<WorkoutTag>>(new Set());

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
  const basicoTemplatesFiltered =
    basicoTagFilter.size === 0
      ? basicoTemplates
      : basicoTemplates.filter((tpl) => tpl.tags?.some((tag) => basicoTagFilter.has(tag)));
  const premiumTemplatesFiltered =
    premiumTagFilter.size === 0
      ? premiumTemplates
      : premiumTemplates.filter((tpl) => tpl.tags?.some((tag) => premiumTagFilter.has(tag)));

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>

        {programsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        {/* Fase 67: ordem revisada — Premium primeiro (maior vitrine de
            conversão da tela), Básico em seguida, "criar novo template"
            penúltimo, "Meus Templates" (os do próprio Personal) por último. */}

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
          {premiumTemplates.length > 0 && (
            <TagFilterChips
              selected={premiumTagFilter}
              onToggle={(tag) => setPremiumTagFilter((prev) => toggleTagInSet(prev, tag))}
              onClear={() => setPremiumTagFilter(new Set())}
              t={t}
            />
          )}
          {premiumTemplates.length > 0 && premiumTemplatesFiltered.length === 0 && (
            <p className="text-sm text-muted">{t("tagFilterEmpty")}</p>
          )}
          <SelfTemplateCarousel
            templates={premiumTemplatesFiltered}
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
          {basicoTemplates.length > 0 && (
            <TagFilterChips
              selected={basicoTagFilter}
              onToggle={(tag) => setBasicoTagFilter((prev) => toggleTagInSet(prev, tag))}
              onClear={() => setBasicoTagFilter(new Set())}
              t={t}
            />
          )}
          {basicoTemplates.length > 0 && basicoTemplatesFiltered.length === 0 && (
            <p className="text-sm text-muted">{t("tagFilterEmpty")}</p>
          )}
          <SelfTemplateCarousel templates={basicoTemplatesFiltered} onSelect={setPreviewTemplate} />
        </section>

        {/* Fase 66: "Montagem Inteligente" saiu do dashboard (que ficou
            focado só em "Explorar Templates"/"Criar treino do zero") e mora
            aqui agora, junto do formulário manual — os 2 jeitos de criar um
            template novo, lado a lado. O formulário fica escondido atrás de
            "+ Criar template" em vez de sempre aberto no topo da tela. */}
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">{t("createNewTitle")}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setGeneratorOpen(true)}>
              {t("smartGenerator")}
            </Button>
            <Button
              variant={showCreateForm ? "secondary" : "default"}
              onClick={() => setShowCreateForm((v) => !v)}
            >
              {showCreateForm ? t("cancelCreate") : t("createTemplateButton")}
            </Button>
          </div>

          {showCreateForm && (
            <form
              className="flex flex-col gap-3 border-t border-border pt-3"
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
          )}
        </Card>

        {/* Fase 67: "Meus Templates" (os do próprio Personal) por último —
            antes vinha primeiro; Premium/Básico/criar agora têm prioridade. */}
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
      </main>

      {generatorOpen && <GenerateWorkoutModal onClose={() => setGeneratorOpen(false)} />}

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
      <Suspense fallback={null}>
        <ProgramasPersonalContent />
      </Suspense>
    </AuthGuard>
  );
}
