"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getAlunoAnamnesis } from "@/lib/api/anamnesis";
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

function AlunoAnamneseContent() {
  const t = useTranslations("nutricionistaAnamneseView");
  const tCommon = useTranslations("common");
  const params = useParams<{ alunoId: string }>();
  const alunoId = params.alunoId;

  const query = useQuery({
    queryKey: ["anamnesis", "aluno", alunoId],
    queryFn: () => getAlunoAnamnesis(alunoId),
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        {query.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {query.isError && <QueryError error={query.error} onRetry={() => query.refetch()} />}

        {query.data?.anamnesis && (
          <>
            <Card className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label={t("fields.fullName")} value={query.data.anamnesis.fullName} />
              <Field label={t("fields.birthDate")} value={query.data.anamnesis.birthDate?.slice(0, 10)} />
              <Field label={t("fields.heightCm")} value={query.data.anamnesis.heightCm} />
              <Field label={t("fields.weightKg")} value={query.data.anamnesis.weightKg} />
            </Card>
            <Card className="flex flex-col gap-4">
              <Field label={t("fields.goals")} value={query.data.anamnesis.goals} />
              <Field label={t("fields.healthConditions")} value={query.data.anamnesis.healthConditions} />
              <Field label={t("fields.medications")} value={query.data.anamnesis.medications} />
              <Field label={t("fields.activityLevel")} value={query.data.anamnesis.activityLevel} />
              <Field label={t("fields.pastExperience")} value={query.data.anamnesis.pastExperience} />
              <Field label={t("fields.trainingPreferences")} value={query.data.anamnesis.trainingPreferences} />
              <Field label={t("fields.injuries")} value={query.data.anamnesis.injuries} />
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function AlunoAnamnesePage() {
  return (
    <AuthGuard allowedRoles={["NUTRICIONISTA"]}>
      <AlunoAnamneseContent />
    </AuthGuard>
  );
}
