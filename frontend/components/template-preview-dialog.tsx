"use client";

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
 */
export function TemplatePreviewDialog({
  template,
  onApply,
  onCancel,
}: {
  template: WorkoutProgram;
  onApply: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("meuTreinoPessoal");
  const tCommon = useTranslations("common");
  const sessions = template.workouts ?? [];

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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={onApply}>
            {t("previewApplyButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
