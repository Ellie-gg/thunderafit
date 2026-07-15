"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listMyWorkouts } from "@/lib/api/workouts";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";

function TreinosContent() {
  const workoutsQuery = useQuery({
    queryKey: ["workouts"],
    queryFn: listMyWorkouts,
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Meus Treinos</h1>

        {workoutsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

        {workoutsQuery.isSuccess && workoutsQuery.data.workouts.length === 0 && (
          <Card>
            <p className="text-sm text-muted">Nenhum treino prescrito ainda.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {workoutsQuery.data?.workouts.map((w) => (
            <Link key={w.id} href={`/treinos/${w.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <span className="font-display text-lg font-bold text-accent">{w.letter}</span>{" "}
                  <span className="font-semibold">{w.name}</span>
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

export default function TreinosPage() {
  return (
    <AuthGuard>
      <TreinosContent />
    </AuthGuard>
  );
}
