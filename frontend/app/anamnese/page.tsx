"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOwnAnamnesis, createAnamnesis, updateAnamnesis } from "@/lib/api/anamnesis";
import type { Anamnesis, AnamnesisInput } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { QueryError } from "@/components/query-error";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

function buildFormFromData(a: Anamnesis | null): AnamnesisInput {
  if (!a) {
    return {
      fullName: "",
      birthDate: "",
      heightCm: undefined,
      weightKg: undefined,
      goals: "",
      healthConditions: "",
      medications: "",
      activityLevel: "",
      pastExperience: "",
      trainingPreferences: "",
      injuries: "",
    };
  }
  return {
    fullName: a.fullName ?? "",
    birthDate: a.birthDate ? a.birthDate.slice(0, 10) : "",
    heightCm: a.heightCm ?? undefined,
    weightKg: a.weightKg ?? undefined,
    goals: a.goals ?? "",
    healthConditions: a.healthConditions ?? "",
    medications: a.medications ?? "",
    activityLevel: a.activityLevel ?? "",
    pastExperience: a.pastExperience ?? "",
    trainingPreferences: a.trainingPreferences ?? "",
    injuries: a.injuries ?? "",
  };
}

/**
 * Componente separado que só monta depois que a query já resolveu — assim o
 * estado inicial do formulário vem direto dos dados já disponíveis no mount
 * (via `useState(() => ...)`), sem precisar de um `useEffect` só para
 * sincronizar `form` com `anamnesisQuery.data` depois que ele chega.
 */
function AnamneseForm({ initial, exists }: { initial: Anamnesis | null; exists: boolean }) {
  const t = useTranslations("anamneseAluno");
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AnamnesisInput>(() => buildFormFromData(initial));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: AnamnesisInput = {
        ...form,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      };
      return exists ? updateAnamnesis(payload) : createAnamnesis(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anamnesis", "own"] });
    },
  });

  function field(key: keyof AnamnesisInput, label: string, placeholder?: string) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          value={(form[key] as string | number | undefined) ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">{t("personalDataHeading")}</h2>
        {field("fullName", t("fullNameLabel"))}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthDate">{t("birthDateLabel")}</Label>
            <Input
              id="birthDate"
              type="date"
              value={(form.birthDate as string) ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            />
          </div>
          {field("heightCm", t("heightLabel"))}
          {field("weightKg", t("weightLabel"))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">{t("goalsHeading")}</h2>
        {field("goals", t("goalsLabel"), t("goalsPlaceholder"))}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">{t("healthHistoryHeading")}</h2>
        {field("healthConditions", t("healthConditionsLabel"), t("healthConditionsPlaceholder"))}
        {field("medications", t("medicationsLabel"))}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">{t("physicalActivityHeading")}</h2>
        {field("activityLevel", t("activityLevelLabel"), t("activityLevelPlaceholder"))}
        {field("pastExperience", t("pastExperienceLabel"))}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">{t("preferencesHeading")}</h2>
        {field("trainingPreferences", t("trainingPreferencesLabel"), t("trainingPreferencesPlaceholder"))}
        {field("injuries", t("injuriesLabel"), t("injuriesPlaceholder"))}
      </Card>

      {saveMutation.isError && (
        <p className="text-sm text-danger">
          {saveMutation.error instanceof ApiError
            ? saveMutation.error.message
            : t("connectionError")}
        </p>
      )}
      {saveMutation.isSuccess && <p className="text-sm text-success">{t("saveSuccess")}</p>}

      <Button type="submit" disabled={saveMutation.isPending} className="self-start">
        {saveMutation.isPending ? t("saving") : t("saveAnamnesis")}
      </Button>
    </form>
  );
}

function AnamneseContent() {
  const t = useTranslations("anamneseAluno");
  const tCommon = useTranslations("common");
  const anamnesisQuery = useQuery({ queryKey: ["anamnesis", "own"], queryFn: getOwnAnamnesis });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        {anamnesisQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

        {anamnesisQuery.isError && (
          <QueryError error={anamnesisQuery.error} onRetry={() => anamnesisQuery.refetch()} />
        )}

        {anamnesisQuery.isSuccess && (
          <AnamneseForm
            // Remonta com os dados frescos (e o `exists` correto) depois que
            // o POST inicial invalida a query e o refetch chega.
            key={anamnesisQuery.dataUpdatedAt}
            initial={anamnesisQuery.data.anamnesis}
            exists={!!anamnesisQuery.data.anamnesis}
          />
        )}
      </main>
    </>
  );
}

export default function AnamnesePage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <AnamneseContent />
    </AuthGuard>
  );
}
