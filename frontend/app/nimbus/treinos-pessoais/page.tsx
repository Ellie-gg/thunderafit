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
import type { SelfTemplateCategory, SessionScheme } from "@/lib/types";

const CATEGORY_OPTIONS: SelfTemplateCategory[] = ["GERAL", "HOME", "PREMIUM", "PRONTOS"];

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
  const templatesQuery = useQuery({
    queryKey: ["admin", "self-templates"],
    queryFn: listAdminSelfTemplates,
  });

  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<SessionScheme>("LETTER");
  const [category, setCategory] = useState<SelfTemplateCategory>("GERAL");
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
    mutationFn: () => createAdminSelfTemplate(name.trim(), scheme, category),
    onSuccess: (data) => {
      setName("");
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("creating") : t("createTemplate")}
            </Button>
          </form>
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
                      {" · "}
                      {t(`categoryOption.${tpl.category}`)}
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
                    {(detailQuery.data?.program.workouts ?? []).map((session) => {
                      const sessionExercises = [...(session.exercises ?? [])].sort(
                        (a, b) => a.order - b.order
                      );
                      return (
                        <div key={session.id} className="rounded-md border border-border p-3">
                          <h4 className="mb-2 font-display text-sm font-bold text-accent">
                            {t("sessionTitle", { label: labelFor(tpl.sessionScheme, session.letter) })}
                          </h4>
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
