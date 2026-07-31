"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { labelFor } from "@/lib/session-scheme";
import type { WorkoutProgram } from "@/lib/types";

/**
 * Fase 59: antes disso, clicar num slide do carrossel disparava a aplicação
 * (ou o diálogo de troca) direto — sem chance de ver as sessões antes de
 * comprometer. Este preview intercepta o clique e mostra nome/descrição/
 * lista de sessões (dado que já vem no `template` — `listSelfTemplates` já
 * inclui `workouts: {id, letter, name}`, sem precisar de nenhuma chamada
 * nova) antes de o aluno confirmar. "Aplicar" fecha o preview e dispara o
 * MESMO fluxo de sempre (`onApply`), incluindo o diálogo de troca em caso de
 * 409 — não muda nada do que já existia, só adia a decisão por uma tela.
 *
 * Fase 62: reaproveitado também pelo catálogo de templates do Personal
 * (Básico/Premium) — quando `alunoOptions` é passado, o botão de aplicar
 * vira um select de aluno vinculado + `onApplyToAluno(alunoId)`, em vez do
 * `onApply()` sem argumento (o aluno aplica pra si mesmo; o Personal precisa
 * escolher a quem).
 */
export function TemplatePreviewDialog({
  template,
  onApply,
  onApplyToAluno,
  alunoOptions,
  onCancel,
  isApplying,
  errorMessage,
}: {
  template: WorkoutProgram;
  onApply?: () => void;
  onApplyToAluno?: (alunoId: string) => void;
  alunoOptions?: { id: string; email: string }[];
  onCancel: () => void;
  // Fr14/Fr16 (auditoria 2026-07-31): antes o diálogo não tinha estado de
  // pendência nem de erro — um 409 (já tem programa aplicado)/402
  // (Premium)/403 (over-limit) ao aplicar não mostrava nada visível (o
  // texto de erro do chamador renderizava ATRÁS do overlay `fixed inset-0
  // z-50` deste diálogo), então o clique parecia simplesmente não ter
  // funcionado — e sem `disabled` no botão, um segundo clique reenviava a
  // mesma aplicação.
  isApplying?: boolean;
  errorMessage?: string | null;
}) {
  const t = useTranslations("meuTreinoPessoal");
  const tCommon = useTranslations("common");
  const sessions = template.workouts ?? [];
  const [selectedAluno, setSelectedAluno] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="font-display text-lg font-bold">{template.name}</h2>
          {template.description && <p className="mt-1 text-xs text-muted">{template.description}</p>}
        </div>

        {sessions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("previewSessionsLabel", { count: sessions.length })}
            </span>
            <ul className="flex flex-col gap-1">
              {sessions.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-display font-bold text-accent">
                    {labelFor(template.sessionScheme, s.letter)}
                  </span>{" "}
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {alunoOptions && (
          <select
            value={selectedAluno}
            onChange={(e) => setSelectedAluno(e.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="" disabled>
              {t("previewSelectStudent")}
            </option>
            {alunoOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        )}

        {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isApplying}>
            {tCommon("cancel")}
          </Button>
          {alunoOptions ? (
            <Button
              type="button"
              disabled={!selectedAluno || isApplying}
              onClick={() => onApplyToAluno?.(selectedAluno)}
            >
              {isApplying ? tCommon("loading") : t("previewApplyButton")}
            </Button>
          ) : (
            <Button type="button" onClick={onApply} disabled={isApplying}>
              {isApplying ? tCommon("loading") : t("previewApplyButton")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
