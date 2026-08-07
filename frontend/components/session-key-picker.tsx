"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { changeWorkoutSessionLetter } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { labelFor } from "@/lib/session-scheme";
import type { SessionScheme } from "@/lib/types";

/**
 * Fase 121 (levantamento do roadmap): trocar a letra (A-E) ou o dia da semana de
 * uma sessão. Antes só o NOME era editável (`InlineRename`, Fase 111), então
 * mover um treino de "B" pra "C" — ou de Segunda pra Quarta — exigia excluir e
 * recriar, perdendo os exercícios prescritos e o histórico de séries.
 *
 * Oferece só a chave ATUAL + as LIVRES (`availableKeys`), então o caminho normal
 * nunca colide. O 409 do backend continua sendo tratado porque a lista pode
 * envelhecer (outra aba, ou o Personal e o aluno mexendo ao mesmo tempo) — a UI
 * evita o erro, não confia que ele não vai acontecer.
 *
 * `<select>` nativo de propósito: é o controle que o Android e o iOS já
 * renderizam como picker rolável, e o projeto não tem biblioteca de dropdown
 * (mesma razão pela qual o resto do app usa `<select>` cru).
 */
export function SessionKeyPicker({
  workoutId,
  currentKey,
  availableKeys,
  scheme,
  onChanged,
}: {
  workoutId: string;
  currentKey: string;
  /** Chaves LIVRES no programa (sem a atual) — quem chama já calcula isso. */
  availableKeys: string[];
  scheme: SessionScheme;
  onChanged?: () => void;
}) {
  const t = useTranslations("sessionKeyPicker");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (letter: string) => changeWorkoutSessionLetter(workoutId, letter),
    onSuccess: () => {
      setError(null);
      onChanged?.();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("changeError"));
    },
  });

  // Sem nenhuma chave livre não há troca possível — mostra só o rótulo, em vez
  // de um select que não faz nada.
  if (availableKeys.length === 0) {
    return <span className="text-xs text-muted">{labelFor(scheme, currentKey)}</span>;
  }

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <div className="flex flex-col items-end gap-1" onClick={stop}>
      <select
        aria-label={t("ariaLabel")}
        value={currentKey}
        disabled={mutation.isPending}
        onClick={stop}
        onChange={(e) => {
          stop(e);
          mutation.mutate(e.target.value);
        }}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
      >
        <option value={currentKey}>{labelFor(scheme, currentKey)}</option>
        {availableKeys.map((k) => (
          <option key={k} value={k}>
            {labelFor(scheme, k)}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
