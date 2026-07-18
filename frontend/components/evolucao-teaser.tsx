"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listLoggedExercises, getLoadHistory } from "@/lib/api/progress";
import { Card } from "@/components/ui/card";

/**
 * Fase 12 (Item 4): gancho compacto para /evolucao no dashboard do aluno —
 * não é o gráfico completo, só um número chamativo. Usa o primeiro exercício
 * com séries registradas (mesma simplificação de "primeiro item da lista"
 * já documentada para "próximo treino"/"plano de hoje" desde as Fases 5/11).
 */
export function EvolucaoTeaser() {
  const exercisesQuery = useQuery({
    queryKey: ["progress-exercises"],
    queryFn: () => listLoggedExercises(),
  });

  const firstExercise = exercisesQuery.data?.exercises[0];

  const loadHistoryQuery = useQuery({
    queryKey: ["load-history", firstExercise?.id],
    queryFn: () => getLoadHistory(firstExercise!.id),
    enabled: !!firstExercise,
  });

  // Ainda carregando, ou erro — não vale a pena mostrar QueryError aqui (é um
  // teaser secundário, não um dado crítico); simplesmente não renderiza nada
  // até ter uma resposta, em vez de ocupar espaço com estado de carregamento.
  if (exercisesQuery.isLoading || (firstExercise && loadHistoryQuery.isLoading)) {
    return null;
  }

  const percent = loadHistoryQuery.data?.percentChangeVsPrevious ?? null;
  const hasVariation = !!firstExercise && percent !== null;

  return (
    <Link href="/evolucao">
      <Card className="flex items-center justify-between border-accent-secondary/40 transition-colors hover:border-accent-secondary">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            Evolução
          </span>
          {hasVariation && (
            <p className="font-mono-nums text-lg font-bold">
              {firstExercise!.name}: {percent! > 0 ? "+" : ""}
              {percent!.toFixed(1)}% na última sessão
            </p>
          )}
          {!hasVariation && (
            <p className="text-sm text-muted">
              Registre suas primeiras séries para ver sua evolução aqui.
            </p>
          )}
        </div>
        <span className="text-sm text-accent-secondary">Ver →</span>
      </Card>
    </Link>
  );
}
