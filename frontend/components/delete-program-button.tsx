"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { deleteWorkoutProgram } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 31: excluir um programa (template ou instância aplicada) — sempre com
 * confirmação inline (sem modal/lib nova): primeiro clique vira uma linha
 * "Tem certeza? [Sim, excluir] [Cancelar]", só o segundo clique de fato
 * apaga. Reutilizado em `/personal/programas`, no hub do aluno e no
 * dashboard — mesmo padrão de callback (`onDeleted`) das Fases 28/29 pra
 * cada tela decidir como invalidar/atualizar sua própria lista.
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

  if (!confirming) {
    return (
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
    );
  }

  return (
    <div
      onClick={stop}
      className="flex flex-col items-end gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-2"
    >
      <p className="text-xs text-danger">
        {isTemplate ? t("confirmDeleteTemplate") : t("confirmDeleteApplied")}
      </p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("deleteError")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={(e) => { stop(e); setConfirming(false); }}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
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
  );
}
