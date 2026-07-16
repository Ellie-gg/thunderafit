"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getWorkoutProgram } from "@/lib/api/workouts";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";

function formatDate(iso: string | null): string {
  if (!iso) return "nunca concluída";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function ProgramaContent() {
  const params = useParams<{ id: string }>();
  const programId = params.id;
  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
  });

  const program = programQuery.data?.program;
  const sessions = [...(program?.workouts ?? [])].sort((a, b) => a.letter.localeCompare(b.letter));

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                Programa
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{program.name}</h1>
              <p className="text-sm text-muted">
                {sessions.length} sessão(ões) · escolha qualquer uma para treinar
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {sessions.map((s) => (
                <Link key={s.id} href={`/treinos/${s.id}`}>
                  <Card
                    className="flex items-center justify-between transition-colors hover:border-accent"
                    style={s.suggestedNext ? { borderColor: "var(--accent)" } : undefined}
                  >
                    <div>
                      <span className="font-display text-lg font-bold text-accent">{s.letter}</span>{" "}
                      <span className="font-semibold">{s.name}</span>
                      <p className="text-xs text-muted">Última conclusão: {formatDate(s.lastCompletedAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {s.suggestedNext && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          Sugerida
                        </span>
                      )}
                      <span className="text-sm text-muted">Abrir →</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function ProgramaPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <ProgramaContent />
    </AuthGuard>
  );
}
