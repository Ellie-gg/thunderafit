"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";

function ProgramasContent() {
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "aluno"],
    queryFn: () => listWorkoutPrograms(),
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Meus Programas</h1>

        {programsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        {programsQuery.isSuccess && programsQuery.data.programs.length === 0 && (
          <Card>
            <p className="text-sm text-muted">Nenhum programa atribuído ainda.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {programsQuery.data?.programs.map((p) => (
            <Link key={p.id} href={`/programas/${p.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <p className="text-xs text-muted">{p.workouts?.length ?? 0} sessão(ões)</p>
                </div>
                <span className="text-sm text-muted">Abrir →</span>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export default function ProgramasPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <ProgramasContent />
    </AuthGuard>
  );
}
