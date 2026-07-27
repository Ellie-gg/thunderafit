"use client";

import { useTranslations } from "next-intl";
import { SPECIALTIES, type Specialty } from "@/lib/constants/professional-directory";

/**
 * Fase 75: lista fixa de especialidades (múltipla escolha) — mesmo padrão de
 * chip toggle já usado pras tags de treino (WorkoutTag).
 */
export function SpecialtyChips({
  selected,
  onToggle,
}: {
  selected: Specialty[];
  onToggle: (specialty: Specialty) => void;
}) {
  const t = useTranslations("specialty");
  return (
    <div className="flex flex-wrap gap-2">
      {SPECIALTIES.map((s) => {
        const isSelected = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(s)}
            className={
              isSelected
                ? "rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
                : "rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent"
            }
          >
            {t(s)}
          </button>
        );
      })}
    </div>
  );
}
