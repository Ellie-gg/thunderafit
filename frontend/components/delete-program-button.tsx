"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { deleteWorkoutProgram } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 31: excluir um programa (template ou instância aplicada) — sempre com
 * dupla confirmação: o primeiro clique abre a confirmação, só o segundo de fato
 * apaga. Reutilizado em `/personal/programas`, no hub do aluno e no
 * dashboard — mesmo padrão de callback (`onDeleted`) das Fases 28/29 pra
 * cada tela decidir como invalidar/atualizar sua própria lista.
 *
 * Fase 123: a confirmação era um box INLINE e sofria do mesmo defeito de layout
 * que o fundador reportou no `delete-session-button` — os textos têm 110 e 128
 * caracteres, e o box vivia num item de uma linha flex de card que não podia
 * encolher, então empurrava a linha pra além da viewport e dava scroll
 * horizontal na página. Corrigido junto, do mesmo jeito (diálogo em overlay,
 * padrão de `replace-self-template-dialog.tsx`): fora do fluxo da linha, não
 * tem como truncar em nenhuma largura.
 *
 * `delete-exercise-button` (68 chars) e `exercise-delete-button` (33 chars)
 * seguem inline de propósito: são curtos e não ficam em linha de card
 * apertada — converter os quatro por simetria trocaria um problema real por
 * quatro modais onde dois não são necessários.
 */
export function DeleteProgramButton({
  programId,
  isTemplate,
  onDeleted,
}: {
  programId: string;
  isTemplate: boolean;
  onDeleted?: () => void;
}) {
  const t = useTranslations("deleteProgramButton");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteWorkoutProgram(programId),
    onSuccess: () => {
      setConfirming(false);
      onDeleted?.();
    },
  });

  // Impede que o clique "vaze" pro <Link> do card em volta (os cards de
  // programa em /personal/programas e no hub são links inteiros clicáveis).
  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          stop(e);
          setConfirming(true);
        }}
      >
        {t("delete")}
      </Button>

      {confirming && (
        <div
          onClick={stop}
          role="dialog"
          aria-modal="true"
          aria-label={t("confirmTitle")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-danger/40 bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-danger">{t("confirmTitle")}</h2>
            <p className="break-words text-sm text-muted">
              {isTemplate ? t("confirmDeleteTemplate") : t("confirmDeleteApplied")}
            </p>
            {mutation.isError && (
              <p className="break-words text-sm text-danger">
                {mutation.error instanceof ApiError ? mutation.error.message : t("deleteError")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={(e) => {
                  stop(e);
                  setConfirming(false);
                }}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={(e) => {
                  stop(e);
                  mutation.mutate();
                }}
              >
                {mutation.isPending ? t("deleting") : t("confirmDelete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
