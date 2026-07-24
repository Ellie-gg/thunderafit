"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkoutPrograms, createWorkoutProgram } from "@/lib/api/workouts";
import { listRelations } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";
import type { SessionScheme } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { DeleteProgramButton } from "@/components/delete-program-button";

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
  const instances = programs.filter((p) => !p.isTemplate);
  // Sem isso, a lista de "Aplicados a alunos" mostrava só o nome do programa
  // — impossível saber qual aluno recebeu qual, sobretudo com vários alunos.
  const alunoEmailById = new Map(relationsQuery.data?.relations.map((r) => [r.id, r.email]) ?? []);

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

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">
            {t("appliedToStudentsTitle", { count: instances.length })}
          </h2>
          {instances.length === 0 && (
            <p className="text-sm text-muted">{t("noAppliedProgramsYet")}</p>
          )}
          {instances.map((p) => (
            <Link key={p.id} href={`/personal/programas/${p.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <p className="text-xs text-muted">
                    {p.alunoId ? alunoEmailById.get(p.alunoId) ?? t("unlinkedStudent") : "—"} ·{" "}
                    {t("sessionsCount", { count: p.workouts?.length ?? 0 })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DeleteProgramButton
                    programId={p.id}
                    isTemplate={false}
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
