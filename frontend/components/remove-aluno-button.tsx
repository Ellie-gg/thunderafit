"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { removeRelation } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 103 — antes desta fase não existia NENHUM jeito de um Personal
 * desvincular um aluno (nem endpoint, nem UI). Criado especificamente como a
 * forma de autorregularização quando o Personal fica acima do limite de
 * alunos do plano atual: sem isso, a única saída de um bloqueio por excesso
 * seria abrir chamado de suporte. Fica disponível mesmo com a prescrição
 * bloqueada (o backend nunca recusa esta ação especificamente). Mesmo padrão
 * de confirmação inline de `DeleteProgramButton` — histórico do aluno é
 * preservado, só o vínculo em si é removido (o backend nunca apaga
 * WorkoutProgram/SetLog nesta operação).
 */
export function RemoveAlunoButton({
  alunoId,
  onRemoved,
}: {
  alunoId: string;
  onRemoved?: () => void;
}) {
  const t = useTranslations("removeAlunoButton");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => removeRelation(alunoId),
    onSuccess: () => {
      setConfirming(false);
      onRemoved?.();
    },
  });

  // Impede que o clique "vaze" pro <Link> do card em volta (os cards de
  // aluno em /personal/alunos são links inteiros clicáveis).
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
        {t("remove")}
      </Button>
    );
  }

  return (
    <div
      onClick={stop}
      className="flex flex-col items-end gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-2"
    >
      <p className="text-xs text-danger">{t("confirmRemove")}</p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("removeError")}
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
          {mutation.isPending ? t("removing") : t("confirmRemoveButton")}
        </Button>
      </div>
    </div>
  );
}
