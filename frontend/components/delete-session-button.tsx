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
 *
 * Fase 123 (bug reportado pelo fundador: "a mensagem de exclusão trunca a
 * tela") — a confirmação virou DIÁLOGO em overlay, no lugar de um box inline.
 * A causa era de layout, não de texto: o box vivia dentro de um item
 * `shrink-0` de uma linha flex (ver as duas telas de programa), e o
 * `confirmDelete` tem 150+ caracteres. Sem poder encolher, o box empurrava a
 * linha pra além da viewport e a página inteira ganhava scroll horizontal.
 * Aumentar o texto ou pôr `max-w` só trocaria de sintoma — em overlay a
 * confirmação simplesmente não participa mais do fluxo da linha, então não tem
 * como truncar nada, em nenhuma largura. Mesmo padrão zero-dependência de
 * `replace-self-template-dialog.tsx`/`post-workout-summary-modal.tsx`.
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

  return (
    <>
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

      {/* O gatilho continua renderizado enquanto o diálogo está aberto: ele é
          quem reserva o espaço na linha. Antes o box de confirmação SUBSTITUÍA
          o botão, e era essa troca que remexia o layout da linha inteira. */}
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
            {/* `break-words` porque o rótulo da sessão é livre (nome digitado
                pelo Personal pode ser uma palavra longa sem espaço). */}
            <p className="break-words text-sm text-muted">
              {t("confirmDelete", { session: sessionLabel })}
            </p>
            {mutation.isError && (
              <p className="break-words text-sm text-danger">
                {mutation.error instanceof ApiError ? mutation.error.message : t("deleteError")}
              </p>
            )}
            {/* `flex-wrap` + `justify-end`: em 320px com textos longos em ES/EN
                os dois botões descem em vez de estourar a largura do diálogo. */}
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
                {mutation.isPending ? t("deleting") : t("confirmButton")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
