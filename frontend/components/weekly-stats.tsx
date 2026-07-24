"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

/**
 * Fase 33.4: substitui o `EvolucaoTeaser` (card grande que, na maioria das
 * vezes, só mostrava um texto de estado vazio) por 2 métricas rápidas.
 * Cor com significado: ciano (`accent-secondary`) pra atividade da semana —
 * "dado positivo" — e dourado (`accent`) pra sequência — mesmo tom do CTA
 * "Começar treino", já que uma sequência ativa é "ação/energia".
 *
 * Fase 39: volume (kg) trocado por contagem de séries — mais fácil de
 * comparar semana a semana (kg varia muito com o exercício/fase do
 * mesociclo; "quantas séries eu fiz" é uma leitura mais direta de esforço).
 */
export function WeeklyStats({ setsThisWeek, streakDays }: { setsThisWeek: number; streakDays: number }) {
  const t = useTranslations("weeklyStats");
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="flex flex-col gap-1 border-accent-secondary/40">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          {t("setsThisWeek")}
        </span>
        <span className="font-mono-nums text-2xl font-bold text-foreground">{setsThisWeek}</span>
      </Card>
      <Card className="flex flex-col gap-1 border-accent/40">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">{t("streak")}</span>
        <span className="font-mono-nums text-2xl font-bold text-foreground">
          {streakDays} <span className="text-sm font-normal text-muted">{t("days")}</span>
        </span>
      </Card>
    </div>
  );
}
