"use client";

import { useTranslations } from "next-intl";
import type { EffortDistribution } from "@/lib/types";

// Fase 112 (plano de captura de dados, crítica de design): o exemplo da
// skill de dashboard era "zona de FC DENTRO de 1 sessão" (amostragem
// contínua, que não existe sem wearable). Sem esse dado, a pergunta que dá
// pra responder de verdade é diferente: distribuição de ESFORÇO ENTRE
// sessões recentes (quantas foram leves/moderadas/intensas) — mesma peça
// visual (barra segmentada, nunca pizza, mesma regra da skill), semântica
// ajustada ao dado real disponível.
export function EffortDistributionBar({ distribution }: { distribution: EffortDistribution }) {
  const t = useTranslations("effortDistributionBar");
  const total = distribution.leve + distribution.moderado + distribution.intenso;

  if (total === 0) {
    return <p className="text-sm text-muted">{t("noData")}</p>;
  }

  const segments = [
    { key: "leve", count: distribution.leve, label: t("leve"), colorClass: "bg-success" },
    { key: "moderado", count: distribution.moderado, label: t("moderado"), colorClass: "bg-accent" },
    { key: "intenso", count: distribution.intenso, label: t("intenso"), colorClass: "bg-danger" },
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-raised">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              className={s.colorClass}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.colorClass}`} aria-hidden />
            {s.label} ({s.count})
          </span>
        ))}
      </div>
    </div>
  );
}
