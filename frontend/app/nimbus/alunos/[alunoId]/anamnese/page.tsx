"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAlunoAnamnesisAsAdmin } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { QueryError } from "@/components/query-error";
import { Card } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function AdminAlunoAnamneseContent() {
  const params = useParams<{ alunoId: string }>();
  const alunoId = params.alunoId;

  const query = useQuery({
    queryKey: ["admin", "anamnesis", "aluno", alunoId],
    queryFn: () => getAlunoAnamnesisAsAdmin(alunoId),
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Anamnese do aluno</h1>
          <p className="text-sm text-muted">Somente leitura — dado de saúde do aluno.</p>
        </div>

        <Card
          className="flex flex-row items-start gap-2 border-2 py-3"
          style={{ borderColor: "var(--role-admin)" }}
        >
          <span aria-hidden>🔒</span>
          <p className="text-sm">
            Este acesso está sendo registrado (quem, quando, qual aluno) — visível a qualquer admin
            em{" "}
            <Link href="/nimbus/logs-acesso" className="font-semibold underline">
              Logs de acesso
            </Link>
            , por ser dado sensível de saúde.
          </p>
        </Card>

        {query.isLoading && <p className="text-sm text-muted">Carregando...</p>}

        {query.isError && <QueryError error={query.error} onRetry={() => query.refetch()} />}

        {query.data?.anamnesis && (
          <>
            <Card className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Nome completo" value={query.data.anamnesis.fullName} />
              <Field label="Nascimento" value={query.data.anamnesis.birthDate?.slice(0, 10)} />
              <Field label="Altura (cm)" value={query.data.anamnesis.heightCm} />
              <Field label="Peso (kg)" value={query.data.anamnesis.weightKg} />
            </Card>
            <Card className="flex flex-col gap-4">
              <Field label="Objetivos" value={query.data.anamnesis.goals} />
              <Field label="Condições de saúde" value={query.data.anamnesis.healthConditions} />
              <Field label="Medicamentos" value={query.data.anamnesis.medications} />
              <Field label="Nível de atividade" value={query.data.anamnesis.activityLevel} />
              <Field label="Experiência anterior" value={query.data.anamnesis.pastExperience} />
              <Field label="Preferências de treino" value={query.data.anamnesis.trainingPreferences} />
              <Field label="Lesões/restrições" value={query.data.anamnesis.injuries} />
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function AdminAlunoAnamnesePage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <AdminAlunoAnamneseContent />
    </AuthGuard>
  );
}
