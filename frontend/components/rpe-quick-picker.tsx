"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { setSessionRpe } from "@/lib/api/workouts";

// Fase 112 (plano de captura de dados pro dashboard histórico): pergunta
// única e OPCIONAL depois do resumo pós-treino — nunca bloqueia a conclusão
// em si (o treino já foi concluído com sucesso antes deste componente
// existir na tela). Simplifica a escala Borg CR10 (0-10) pra 5 níveis com
// rótulo, em vez de 11 botões numéricos — mais rápido de responder no
// celular, ainda grava um RPE real (2/4/6/8/10) no backend. Não existe botão
// de "pular": fechar o modal (ou simplesmente não tocar aqui) já é o pular.
const LEVELS: Array<{ rpe: number; labelKey: string; emoji: string }> = [
  { rpe: 2, labelKey: "levelVeryLight", emoji: "😌" },
  { rpe: 4, labelKey: "levelLight", emoji: "🙂" },
  { rpe: 6, labelKey: "levelModerate", emoji: "😐" },
  { rpe: 8, labelKey: "levelHard", emoji: "😖" },
  { rpe: 10, labelKey: "levelVeryHard", emoji: "🥵" },
];

export function RpeQuickPicker({ sessionLogId }: { sessionLogId: string }) {
  const t = useTranslations("rpeQuickPicker");
  const [selected, setSelected] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (rpe: number) => setSessionRpe(sessionLogId, rpe),
    onSuccess: (_data, rpe) => setSelected(rpe),
  });

  if (selected !== null) {
    return <p className="text-center text-sm text-success">{t("confirmed")}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-muted">{t("title")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {LEVELS.map((level) => (
          <button
            key={level.rpe}
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(level.rpe)}
            className="flex flex-col items-center gap-1 rounded-md border border-border px-2.5 py-2 text-xs text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
          >
            <span className="text-xl" aria-hidden>
              {level.emoji}
            </span>
            {t(level.labelKey)}
          </button>
        ))}
      </div>
      {mutation.isError && <p className="text-xs text-danger">{t("error")}</p>}
    </div>
  );
}
