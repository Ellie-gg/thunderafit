"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/input";

/**
 * Achado reportado pelo fundador: o aluno não conseguia mudar nem o nome do
 * programa nem o nome do "treino do dia" (sessão) — o nome só era definido
 * na criação, sem NENHUM controle de edição depois (nem pro aluno, nem pro
 * Personal — ver `PATCH /api/workout-programs/:id/name` e
 * `PATCH /api/workouts/:id/name`). Este componente é o controle de edição
 * genérico reaproveitado nas 4 telas (aluno/Personal × programa/sessão) —
 * clique no lápis vira um input inline, Enter salva, Esc cancela.
 */
export function InlineRename({
  value,
  onSave,
  ariaLabel,
  textClassName,
  hidden = false,
}: {
  value: string;
  onSave: (name: string) => Promise<unknown>;
  ariaLabel: string;
  textClassName?: string;
  /** Ex: sem Premium / sem permissão de edição — esconde o lápis, mostra só o texto. */
  hidden?: boolean;
}) {
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className={textClassName}>{value}</span>
        {!hidden && (
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={() => {
              setDraft(value);
              setError(null);
              setEditing(true);
            }}
            className="rounded p-1 text-xs text-muted hover:bg-surface-raised hover:text-foreground"
          >
            ✏️
          </button>
        )}
      </span>
    );
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setEditing(false);
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("genericError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          disabled={isPending}
          className="h-8 w-auto min-w-40 px-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          aria-label={tCommon("save")}
          className="rounded p-1 text-sm text-success hover:bg-surface-raised disabled:opacity-50"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={isPending}
          aria-label={tCommon("cancel")}
          className="rounded p-1 text-sm text-muted hover:bg-surface-raised disabled:opacity-50"
        >
          ✕
        </button>
      </span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
