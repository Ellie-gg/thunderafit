"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminSelfTemplates,
  getAdminSelfTemplate,
  createAdminSelfTemplate,
  addSessionToAdminSelfTemplate,
  addExerciseToAdminSelfSession,
  deleteAdminSelfTemplate,
  updateAdminSelfTemplate,
  updateAdminSelfTemplateTags,
  updateAdminSelfSession,
} from "@/lib/api/admin";
import { orderFor, labelFor } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/query-error";
import { AddExerciseForm } from "@/components/add-exercise-form";
import { TemplateBannerUpload } from "@/components/template-banner-upload";
import type { SelfTemplateCategory, SessionScheme, WorkoutTag } from "@/lib/types";

const CATEGORY_OPTIONS: SelfTemplateCategory[] = ["GERAL", "HOME", "PREMIUM", "PRONTOS"];

// Fase 63: tags de filtro rápido (chips) — só fazem sentido em templates
// origin: SELF (o carrossel "Treinos Premium" é do aluno).
const TAG_OPTIONS: WorkoutTag[] = ["FEMININO", "HIPERTROFIA", "DEFINICAO", "EXPRESS"];

function toggleTag(tags: WorkoutTag[], tag: WorkoutTag): WorkoutTag[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

/**
 * Fase 63: checkboxes de tags (multi-seleção) — usado tanto no formulário de
 * criação (estado local, salvo junto com o template logo após criar) quanto
 * na edição de um template já existente (mutação própria, mesmo padrão de
 * "salvo" que some sozinho de `NameTranslationEditor`).
 */
function TagCheckboxes({
  tLabel,
  selected,
  onToggle,
}: {
  tLabel: (tag: WorkoutTag) => string;
  selected: WorkoutTag[];
  onToggle: (tag: WorkoutTag) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TAG_OPTIONS.map((tag) => (
        <button
          key={tag}
          type="button"
          aria-pressed={selected.includes(tag)}
          onClick={() => onToggle(tag)}
          className={
            selected.includes(tag)
              ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
              : "rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent"
          }
        >
          {tLabel(tag)}
        </button>
      ))}
    </div>
  );
}

function TemplateTagEditor({ programId, initialTags }: { programId: string; initialTags: WorkoutTag[] }) {
  const t = useTranslations("nimbusTreinosPessoais");
  const [tags, setTags] = useState<WorkoutTag[]>(initialTags);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateAdminSelfTemplateTags(programId, tags),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("tagsLabel")}</Label>
      <TagCheckboxes
        tLabel={(tag) => t(`tagOption.${tag}`)}
        selected={tags}
        onToggle={(tag) => setTags((prev) => toggleTag(prev, tag))}
      />
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("savingNames") : saved ? t("namesSaved") : t("saveNames")}
        </Button>
      </div>
      {mutation.isError && <p className="text-xs text-danger">{t("saveNamesError")}</p>}
    </div>
  );
}

// Fase 62: mesma tela cura os 2 catálogos — "SELF" (aluno, "Meu treino
// pessoal") e "PERSONAL_CATALOG" ("Templates Básico" do Personal, gratuito).
type TemplateOrigin = "SELF" | "PERSONAL_CATALOG";
const ORIGIN_TABS: TemplateOrigin[] = ["SELF", "PERSONAL_CATALOG"];

/**
 * Fase 55.2: edição do nome PT + tradução EN/ES — mesmo componente serve o
 * nome do template e o de cada sessão, só muda o rótulo do primeiro campo e
 * a função de submit (`onSave`). Sempre pré-preenchido com o valor atual
 * (nunca abre em branco), com feedback local de "salvo" que some sozinho.
 */
function NameTranslationEditor({
  nameLabel,
  initialName,
  initialEN,
  initialES,
  withDescription = false,
  initialDescription,
  initialDescriptionEN,
  initialDescriptionES,
  onSave,
}: {
  nameLabel: string;
  initialName: string;
  initialEN?: string;
  initialES?: string;
  /** Fase 59: só o template (não a sessão) tem descrição ("Foco"). */
  withDescription?: boolean;
  initialDescription?: string | null;
  initialDescriptionEN?: string;
  initialDescriptionES?: string;
  onSave: (input: {
    name: string;
    nameEN?: string;
    nameES?: string;
    description?: string;
    descriptionEN?: string;
    descriptionES?: string;
  }) => Promise<unknown>;
}) {
  const t = useTranslations("nimbusTreinosPessoais");
  const [name, setName] = useState(initialName);
  const [nameEN, setNameEN] = useState(initialEN ?? "");
  const [nameES, setNameES] = useState(initialES ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [descriptionEN, setDescriptionEN] = useState(initialDescriptionEN ?? "");
  const [descriptionES, setDescriptionES] = useState(initialDescriptionES ?? "");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      onSave({
        name: name.trim(),
        nameEN: nameEN.trim(),
        nameES: nameES.trim(),
        ...(withDescription
          ? { description: description.trim(), descriptionEN: descriptionEN.trim(), descriptionES: descriptionES.trim() }
          : {}),
      }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <Label>{nameLabel}</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <Label>{t("nameEnLabel")}</Label>
          <Input value={nameEN} onChange={(e) => setNameEN(e.target.value)} />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <Label>{t("nameEsLabel")}</Label>
          <Input value={nameES} onChange={(e) => setNameES(e.target.value)} />
        </div>
      </div>
      {withDescription && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <Label>{t("descriptionLabel")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <Label>{t("descriptionEnLabel")}</Label>
            <Input value={descriptionEN} onChange={(e) => setDescriptionEN(e.target.value)} />
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <Label>{t("descriptionEsLabel")}</Label>
            <Input value={descriptionES} onChange={(e) => setDescriptionES(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? t("savingNames") : saved ? t("namesSaved") : t("saveNames")}
        </Button>
      </div>
      {mutation.isError && <p className="text-xs text-danger">{t("saveNamesError")}</p>}
    </form>
  );
}

/**
 * Fase 34.5 — curadoria de templates "Meu treino pessoal" (origin: SELF).
 * Tela só de admin: cria templates, adiciona sessões e exercícios (reaproveita
 * o mesmo seletor de exercício do fluxo do Personal via `AddExerciseForm`,
 * trocando só a função de submit). O aluno nunca monta nada — só escolhe e
 * aplica (Fase 34.5, tela /meu-treino-pessoal).
 */
function TreinosPessoaisContent() {
  const t = useTranslations("nimbusTreinosPessoais");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState<TemplateOrigin>("SELF");
  const templatesQuery = useQuery({
    queryKey: ["admin", "self-templates", origin],
    queryFn: () => listAdminSelfTemplates(origin),
  });

  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<SessionScheme>("LETTER");
  const [category, setCategory] = useState<SelfTemplateCategory>("GERAL");
  const [newTags, setNewTags] = useState<WorkoutTag[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fase 34.5: a listagem só traz {id, letter, name} por sessão (sem
  // exercícios) — busca o detalhe completo só do template expandido, pra não
  // pesar a listagem inteira com todo exercício de todo template de uma vez.
  const detailQuery = useQuery({
    queryKey: ["admin", "self-template", expandedId],
    queryFn: () => getAdminSelfTemplate(expandedId!),
    enabled: !!expandedId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "self-templates"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "self-template", expandedId] });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await createAdminSelfTemplate(name.trim(), scheme, category, origin);
      // Fase 63: tags só existem em SELF — atalho pra já sair marcado, sem
      // precisar reabrir o template recém-criado pra editar de novo.
      if (origin === "SELF" && newTags.length > 0) {
        await updateAdminSelfTemplateTags(created.program.id, newTags);
      }
      return created;
    },
    onSuccess: (data) => {
      setName("");
      setNewTags([]);
      invalidate();
      setExpandedId(data.program.id);
    },
  });

  const addSessionMutation = useMutation({
    mutationFn: (vars: { programId: string; letter: string }) =>
      addSessionToAdminSelfTemplate(vars.programId, vars.letter),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (programId: string) => deleteAdminSelfTemplate(programId),
    onSuccess: invalidate,
  });

  const templates = templatesQuery.data?.programs ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted">
            {t("description", { count: templates.length })}
          </p>
        </div>

        {/* Fase 62: alterna entre os 2 catálogos curados nesta mesma tela —
            "Meu treino pessoal" (aluno) e "Templates Básico" (Personal). */}
        <div className="flex gap-2 border-b border-border">
          {ORIGIN_TABS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                setOrigin(o);
                setExpandedId(null);
              }}
              className={`border-b-2 px-1 pb-2 text-sm font-semibold ${
                origin === o
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t(`originTab.${o}`)}
            </button>
          ))}
        </div>

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">{t("newTemplate")}</h2>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheme">{t("schemeLabel")}</Label>
              <select
                id="scheme"
                value={scheme}
                onChange={(e) => setScheme(e.target.value as SessionScheme)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="LETTER">{t("schemeOption.letter")}</option>
                <option value="WEEKDAY">{t("schemeOption.weekday")}</option>
              </select>
            </div>
            {/* Fase 62: category é semântica só do catálogo do aluno (SELF)
                — "Templates Básico" do Personal não tem carrossel por
                categoria, então o seletor some pra esse origin. */}
            {origin === "SELF" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">{t("categoryLabel")}</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SelfTemplateCategory)}
                  className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`categoryOption.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("creating") : t("createTemplate")}
            </Button>
          </form>
          {/* Fase 63: tags são semântica só de SELF (filtro do carrossel
              Premium do aluno) — some pra Templates Básico, igual category. */}
          {origin === "SELF" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("tagsLabel")}</Label>
              <TagCheckboxes
                tLabel={(tag) => t(`tagOption.${tag}`)}
                selected={newTags}
                onToggle={(tag) => setNewTags((prev) => toggleTag(prev, tag))}
              />
            </div>
          )}
          {createMutation.isError && (
            <p className="text-sm text-danger">{t("createError")}</p>
          )}
        </Card>

        {templatesQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {templatesQuery.isError && (
          <QueryError error={templatesQuery.error} onRetry={() => templatesQuery.refetch()} />
        )}

        <div className="flex flex-col gap-3">
          {templates.map((tpl) => {
            const expanded = expandedId === tpl.id;
            const usedKeys = new Set((tpl.workouts ?? []).map((w) => w.letter));
            const availableKeys = orderFor(tpl.sessionScheme).filter((k) => !usedKeys.has(k));

            return (
              <Card key={tpl.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                      {tpl.sessionScheme === "WEEKDAY" ? t("schemeOption.weekday") : t("schemeName.letter")}
                    </span>
                    <h3 className="font-display text-lg font-bold">{tpl.name}</h3>
                    <p className="text-xs text-muted">
                      {t("sessionCount", { count: tpl.workouts?.length ?? 0 })}
                      {origin === "SELF" && (
                        <>
                          {" · "}
                          {t(`categoryOption.${tpl.category}`)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedId(expanded ? null : tpl.id)}
                    >
                      {expanded ? t("close") : t("edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(t("deleteConfirm", { name: tpl.name }))) {
                          deleteMutation.mutate(tpl.id);
                        }
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </div>

                {deleteMutation.isError && deleteMutation.variables === tpl.id && (
                  <p className="text-sm text-danger">{t("deleteError")}</p>
                )}

                <TemplateBannerUpload
                  programId={tpl.id}
                  currentBannerUrl={tpl.bannerImageUrl}
                  onUpdated={invalidate}
                />

                {expanded && (
                  <div className="flex flex-col gap-4 border-t border-border pt-3">
                    {detailQuery.isLoading && (
                      <p className="text-sm text-muted">{t("loadingSessions")}</p>
                    )}

                    {/* C6 (auditoria 2026-07-31): sem isto, uma falha aqui
                        abria o painel de edição vazio, mas com os botões "+
                        A/B/C" ainda ativos (achavam que não havia sessão
                        nenhuma ainda) — dava pra criar sessões duplicadas
                        por cima de um template que na verdade já tinha
                        conteúdo, só não carregado. */}
                    {detailQuery.isError && (
                      <p className="text-sm text-danger">{t("detailLoadError")}</p>
                    )}

                    {detailQuery.data?.program && (
                      <div className="rounded-md border border-border p-3">
                        <h4 className="mb-2 font-display text-sm font-bold text-accent">
                          {t("translationsTitle")}
                        </h4>
                        <NameTranslationEditor
                          nameLabel={t("nameLabel")}
                          initialName={detailQuery.data.program.name}
                          initialEN={detailQuery.data.program.translations?.EN}
                          initialES={detailQuery.data.program.translations?.ES}
                          withDescription
                          initialDescription={detailQuery.data.program.description}
                          initialDescriptionEN={detailQuery.data.program.translationDescriptions?.EN}
                          initialDescriptionES={detailQuery.data.program.translationDescriptions?.ES}
                          onSave={(input) => updateAdminSelfTemplate(tpl.id, input).then(invalidate)}
                        />
                        {origin === "SELF" && (
                          <div className="mt-3 border-t border-border pt-3">
                            <TemplateTagEditor
                              programId={tpl.id}
                              initialTags={detailQuery.data.program.tags}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {(detailQuery.data?.program.workouts ?? []).map((session) => {
                      const sessionExercises = [...(session.exercises ?? [])].sort(
                        (a, b) => a.order - b.order
                      );
                      return (
                        <div key={session.id} className="rounded-md border border-border p-3">
                          <h4 className="mb-2 font-display text-sm font-bold text-accent">
                            {t("sessionTitle", { label: labelFor(tpl.sessionScheme, session.letter) })}
                          </h4>
                          <div className="mb-3">
                            <NameTranslationEditor
                              nameLabel={t("sessionNameLabel")}
                              initialName={session.name}
                              initialEN={session.translations?.EN}
                              initialES={session.translations?.ES}
                              onSave={(input) =>
                                updateAdminSelfSession(tpl.id, session.id, input).then(invalidate)
                              }
                            />
                          </div>
                          {sessionExercises.length > 0 && (
                            <ul className="mb-3 flex flex-col gap-1">
                              {sessionExercises.map((ex) => (
                                <li key={ex.id} className="text-sm">
                                  <span className="font-mono-nums text-xs text-muted">
                                    #{ex.order}
                                  </span>{" "}
                                  {ex.exercise?.name}{" "}
                                  <span className="text-xs text-muted">
                                    ({ex.sets}x {ex.repsRange})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <AddExerciseForm
                            workoutId={session.id}
                            nextOrder={sessionExercises.length + 1}
                            addExerciseFn={(sessionId, input) =>
                              addExerciseToAdminSelfSession(tpl.id, sessionId, input)
                            }
                            onAdded={invalidate}
                          />
                        </div>
                      );
                    })}

                    {availableKeys.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {availableKeys.map((key) => (
                          <Button
                            key={key}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={addSessionMutation.isPending}
                            onClick={() =>
                              addSessionMutation.mutate({ programId: tpl.id, letter: key })
                            }
                          >
                            + {labelFor(tpl.sessionScheme, key)}
                          </Button>
                        ))}
                      </div>
                    )}
                    {addSessionMutation.isError && (
                      <p className="text-sm text-danger">{t("addSessionError")}</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {templatesQuery.isSuccess && templates.length === 0 && (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
        </div>
      </main>
    </>
  );
}

export default function TreinosPessoaisPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <TreinosPessoaisContent />
    </AuthGuard>
  );
}
