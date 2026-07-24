"use client";

import { useTranslations } from "next-intl";
import type { DifficultyLevel } from "@/lib/types";

const META: Record<DifficultyLevel, { key: string; color: string }> = {
  // Verde/amarelo/vermelho seriam as cores de status (reservadas). Uso a
  // própria paleta Voltagem em intensidade crescente para não colidir com
  // success/danger e manter o registro visual do produto.
  INICIANTE: { key: "iniciante", color: "var(--role-aluno)" },
  INTERMEDIARIO: { key: "intermediario", color: "var(--role-personal)" },
  AVANCADO: { key: "avancado", color: "var(--role-nutricionista)" },
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  const t = useTranslations("difficultyBadge");
  const meta = META[level] ?? META.INTERMEDIARIO;
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{ borderColor: meta.color, color: meta.color }}
    >
      {t(meta.key)}
    </span>
  );
}
