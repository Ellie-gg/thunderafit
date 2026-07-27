"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getWorkout } from "@/lib/api/workouts";
import { labelFor } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { ExercisePreviewCard } from "@/components/exercise-preview-card";

/**
 * Fase 65 — "Ver como o aluno vê": preview somente-leitura da sessão, no
 * mesmo layout visual da tela de execução do aluno (`/treinos/:id`) — nome
 * grande, um card por exercício com mídia/descrição/prescrição — mas sem
 * nenhum dos elementos que gravam dado do aluno (sem checkbox de concluído,
 * sem barra de progresso de séries, sem formulário de registrar série).
 * Reaproveita `GET /api/workouts/:id`, que já libera o Personal dono do
 * treino (mesma regra usada pela tela de edição) — nenhum endpoint novo.
 */
function VisualizarSessaoContent() {
  const t = useTranslations("personalSessaoVisualizar");
  const tCommon = useTranslations("common");
  const params = useParams<{ id: string; sessionId: string }>();
  const searchParams = useSearchParams();
  const programId = params.id;
  const sessionId = params.sessionId;
  const alunoIdParam = searchParams.get("alunoId") ?? "";
  const query = alunoIdParam ? `?alunoId=${alunoIdParam}` : "";

  const workoutQuery = useQuery({
    queryKey: ["workout", sessionId],
    queryFn: () => getWorkout(sessionId),
  });

  const workout = workoutQuery.data?.workout;
  const exercises = [...(workout?.exercises ?? [])].sort((a, b) => a.order - b.order);

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <Link
          href={`/personal/programas/${programId}/sessoes/${sessionId}${query}`}
          className="inline-block text-xs font-semibold text-muted hover:text-foreground"
        >
          {t("backToEdit")}
        </Link>

        {workoutQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {workoutQuery.isError && (
          <QueryError error={workoutQuery.error} onRetry={() => workoutQuery.refetch()} />
        )}

        {workout && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("previewLabel")}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {labelFor(workout.program?.sessionScheme ?? "LETTER", workout.letter)} — {workout.name}
              </h1>
            </div>

            {exercises.length === 0 && <Card><p className="text-sm text-muted">{t("noExercises")}</p></Card>}

            <div className="flex flex-col gap-4">
              {exercises.map((ex) => (
                <ExercisePreviewCard key={ex.id} workoutExercise={ex} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function VisualizarSessaoPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL", "NUTRICIONISTA"]}>
      <VisualizarSessaoContent />
    </AuthGuard>
  );
}
