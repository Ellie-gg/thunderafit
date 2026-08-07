"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { setSessionRpe } from "@/lib/api/workouts";

// Fase 112 (plano de captura de dados pro dashboard histórico): pergunta
// única e OPCIONAL depois do resumo pós-treino — nunca bloqueia a conclusão
// em si (o treino já foi concluído com sucesso antes deste componente
// existir na tela). Simplifica a escala Borg CR10 (0-10) pra 5 níveis com
// rótulo, em vez de 11 botões numéricos — mais rápido de responder no
// celular, ainda grava um RPE real (2/4/6/8/10) no backend. Não existe botão
// de "pular": fechar o modal (ou simplesmente não tocar aqui) já é o pular.
// A3 (auditoria 2026-08-06): estes valores são ACOPLADOS às faixas de
// `effortDistribution` no backend (`src/progress/services/progress.service.ts`:
// `rpe <= 3 → leve`, `<= 6 → moderado`, senão `intenso`), que são a leitura
// PADRÃO da escala Borg CR10. Antes, "Leve" gravava 4 — e 4 é moderado na
// Borg, então a barra de "Distribuição de esforço" em /evolucao contradizia
// literalmente o rótulo que o aluno tocou ("Leve" aparecia como "Moderado"),
// e a faixa "Leve" era impossível de reportar. A correção é no valor emitido,
// não nos limiares: cada nível agora cai no MEIO da faixa Borg que o próprio
// rótulo promete. Ao mexer aqui, confira `__tests__/components/rpe-quick-picker.test.tsx`,
// que trava esse mapeamento justamente pra impedir que ele volte a divergir.
const LEVELS: Array<{ rpe: number; labelKey: string; emoji: string }> = [
  { rpe: 2, labelKey: "levelVeryLight", emoji: "😌" }, // → leve
  { rpe: 3, labelKey: "levelLight", emoji: "🙂" }, // → leve
  { rpe: 5, labelKey: "levelModerate", emoji: "😐" }, // → moderado
  { rpe: 7, labelKey: "levelHard", emoji: "😖" }, // → intenso
  { rpe: 9, labelKey: "levelVeryHard", emoji: "🥵" }, // → intenso
];

export function RpeQuickPicker({ sessionLogId }: { sessionLogId: string }) {
  const t = useTranslations("rpeQuickPicker");
  const [selected, setSelected] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (rpe: number) => setSessionRpe(sessionLogId, rpe),
    onSuccess: (_data, rpe) => {
      setSelected(rpe);
      // B1 (auditoria 2026-08-06): a resposta de RPE alimenta a barra de
      // distribuição de esforço e a carga de treino de `/evolucao` (e da tela
      // do Personal) — sem invalidar, o aluno que responde e navega pra lá em
      // menos de 30s (staleTime global) vê os gráficos sem a resposta que
      // acabou de dar. Mesma família dos Fr5/Fr6/Fr7.
      queryClient.invalidateQueries({ queryKey: ["session-history"] });
    },
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
