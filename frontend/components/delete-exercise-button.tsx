"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { deleteAdminExercise } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 33: excluir um exercício do catálogo — mesmo padrão de confirmação
 * inline do `DeleteProgramButton` (Fase 31), sem modal/lib nova. O backend
 * bloqueia (409) exercícios referenciados em alguma prescrição — a mensagem
 * de erro do servidor já explica isso, só precisamos exibi-la.
 */
export function DeleteExerciseButton({
  exerciseId,
  onDeleted,
}: {
  exerciseId: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("deleteExerciseButton");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteAdminExercise(exerciseId),
    onSuccess: () => {
      setConfirming(false);
      onDeleted?.();
    },
  });

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {t("delete")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-2">
      <p className="text-xs text-danger">{t("confirmDelete")}</p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("deleteError")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => setConfirming(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("deleting") : t("confirmDeleteYes")}
        </Button>
      </div>
    </div>
  );
}
