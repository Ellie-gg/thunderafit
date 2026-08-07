"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { deleteWorkoutSession } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 120 (pedido do fundador): excluir uma SESSÃO do programa — o "treino do
 * dia" (A-E) ou o dia da semana. Antes só existia excluir um EXERCÍCIO da
 * sessão, ou o PROGRAMA inteiro; tirar uma sessão errada obrigava a apagar e
 * remontar o programa todo.
 *
 * Modelado em `delete-program-button.tsx` (Fase 31), incluindo o `stop()`: os
 * cards de sessão são `<Link>` inteiros clicáveis, então sem isso o clique
 * "vaza" e navega pra tela de prescrição em vez de confirmar.
 *
 * O aviso é mais forte que o de excluir exercício de propósito: a sessão leva
 * com ela os exercícios prescritos E o histórico de séries registradas
 * (`SetLog`), que é dado do aluno e não tem como recuperar.
 */
export function DeleteSessionButton({
  workoutId,
  sessionLabel,
  onDeleted,
}: {
  workoutId: string;
  /** Rótulo já formatado (ex: "A" ou "Segunda") — só pra deixar o aviso concreto. */
  sessionLabel: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("deleteSessionButton");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteWorkoutSession(workoutId),
    onSuccess: () => {
      setConfirming(false);
      onDeleted?.();
    },
  });

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
        aria-label={t("deleteAriaLabel", { session: sessionLabel })}
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
      <p className="text-xs text-danger">{t("confirmDelete", { session: sessionLabel })}</p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("deleteError")}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
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
          size="sm"
          disabled={mutation.isPending}
          onClick={(e) => {
            stop(e);
            mutation.mutate();
          }}
        >
          {mutation.isPending ? t("deleting") : t("confirmButton")}
        </Button>
      </div>
    </div>
  );
}
