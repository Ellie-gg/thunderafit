"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Fase 52: modal de confirmação pra troca de treino pessoal ativo (mesmo
 * padrão zero-dependência de overlay do PostWorkoutSummaryModal — este
 * projeto não tem lib de dialog instalada). Só aparece quando o backend
 * devolve 409 SELF_PROGRAM_EXISTS ao aplicar um template de "Treino em Casa".
 */
export function ReplaceSelfTemplateDialog({
  existingProgramName,
  onConfirm,
  onCancel,
  isPending = false,
  errorMessage = null,
}: {
  existingProgramName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  errorMessage?: string | null;
}) {
  const t = useTranslations("meuTreinoPessoal");
  const tCommon = useTranslations("common");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold">{t("replaceDialogTitle")}</h2>
        <p className="text-sm text-muted">
          {t("replaceDialogMessage", { name: existingProgramName })}
        </p>
        {/* Fr13/Fr14 (auditoria 2026-07-31): `replaceMutation` não tinha
            NENHUM tratamento de erro — em 3G, clicar "Substituir" e falhar
            (ex: 402 de Premium expirado no meio do fluxo) não mostrava nada;
            o diálogo continuava idêntico e o aluno clicava várias vezes. */}
        {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" variant="secondary" onClick={onConfirm} disabled={isPending}>
            {isPending ? t("replacing") : t("replaceDialogConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
