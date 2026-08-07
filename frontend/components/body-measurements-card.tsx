"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listBodyMeasurements,
  createBodyMeasurement,
  deleteBodyMeasurement,
} from "@/lib/api/body";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { isoToDateInput, dateInputToIso } from "@/lib/date-input";

/**
 * Fase 121: histórico de medições corporais.
 *
 * Existe porque `Anamnesis` é `alunoId @unique` — um snapshot sobrescrito. O app
 * acompanhava a progressão de CARGA com riqueza (recordes, /evolucao) e não
 * tinha nada da progressão CORPORAL, que é justamente o que o aluno associa a
 * "está funcionando".
 *
 * Campos: peso obrigatório, cintura e % de gordura opcionais (decisão do
 * fundador). Peso isolado engana — ganho de músculo mascara perda de gordura —,
 * e a cintura é o perímetro que a pessoa percebe na roupa.
 *
 * `alunoId` presente = o Personal lançando a avaliação presencial de um aluno
 * vinculado; ausente = o aluno registrando o próprio peso.
 */
export function BodyMeasurementsCard({ alunoId }: { alunoId?: string }) {
  const t = useTranslations("bodyMeasurementsCard");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const queryClient = useQueryClient();

  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [measuredAt, setMeasuredAt] = useState(() => isoToDateInput(new Date().toISOString()));

  const chave = ["body-measurements", alunoId ?? "self"];
  const query = useQuery({ queryKey: chave, queryFn: () => listBodyMeasurements(alunoId) });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: chave });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createBodyMeasurement(
        {
          weightKg,
          waistCm: waistCm || undefined,
          bodyFatPercent: bodyFatPercent || undefined,
          // M1 (auditoria 2026-08-06): converte pelo fuso LOCAL. `new Date("YYYY-MM-DD")`
          // é meia-noite UTC e voltaria como o dia anterior no Brasil.
          measuredAt: measuredAt ? dateInputToIso(measuredAt) : undefined,
        },
        alunoId
      ),
    onSuccess: () => {
      setWeightKg("");
      setWaistCm("");
      setBodyFatPercent("");
      invalidar();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBodyMeasurement(id),
    onSuccess: invalidar,
  });

  const measurements = query.data?.measurements ?? [];

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">{t("title")}</h2>
        <p className="text-xs text-muted">{alunoId ? t("subtitlePersonal") : t("subtitle")}</p>
      </div>

      <form
        className="flex flex-col gap-2 rounded-md border border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!weightKg.trim()) return;
          createMutation.mutate();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bm-weight">{t("weightLabel")}</Label>
            <Input
              id="bm-weight"
              inputMode="decimal"
              placeholder={t("weightPlaceholder")}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bm-date">{t("dateLabel")}</Label>
            <Input
              id="bm-date"
              type="date"
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bm-waist">{t("waistLabel")}</Label>
            <Input
              id="bm-waist"
              inputMode="decimal"
              placeholder={t("optionalPlaceholder")}
              value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bm-fat">{t("bodyFatLabel")}</Label>
            <Input
              id="bm-fat"
              inputMode="decimal"
              placeholder={t("optionalPlaceholder")}
              value={bodyFatPercent}
              onChange={(e) => setBodyFatPercent(e.target.value)}
            />
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-sm text-danger">
            {createMutation.error instanceof ApiError ? createMutation.error.message : t("saveError")}
          </p>
        )}

        <Button type="submit" className="self-start" disabled={createMutation.isPending || !weightKg.trim()}>
          {createMutation.isPending ? t("saving") : t("save")}
        </Button>
      </form>

      {query.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
      {query.isError && <QueryError error={query.error} onRetry={() => query.refetch()} />}

      {/* `isSuccess &&` explícito: um erro de rede não pode virar "nenhuma
          medição ainda", que afirmaria algo falso (classe do Fr13). */}
      {query.isSuccess && measurements.length === 0 && (
        <p className="text-sm text-muted">{t("empty")}</p>
      )}

      {query.isSuccess && measurements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="py-1 pr-3 font-semibold">{t("dateColumn")}</th>
                <th className="py-1 pr-3 font-semibold">{t("weightColumn")}</th>
                <th className="py-1 pr-3 font-semibold">{t("waistColumn")}</th>
                <th className="py-1 pr-3 font-semibold">{t("bodyFatColumn")}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-1 pr-3 whitespace-nowrap tabular-nums">
                    {new Date(m.measuredAt).toLocaleDateString(intlLocale)}
                    {/* Distingue balança de casa de avaliação presencial. */}
                    {m.recordedByRole !== "ALUNO" && (
                      <span className="ml-1 text-xs text-accent-secondary">{t("byProfessional")}</span>
                    )}
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap tabular-nums">
                    {t("weightValue", { value: m.weightKg })}
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap tabular-nums">
                    {m.waistCm === null ? "—" : t("waistValue", { value: m.waistCm })}
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap tabular-nums">
                    {m.bodyFatPercent === null ? "—" : t("bodyFatValue", { value: m.bodyFatPercent })}
                  </td>
                  <td className="py-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t("deleteAriaLabel")}
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(m.id)}
                    >
                      {t("delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteMutation.isError && (
        <p className="text-sm text-danger">
          {deleteMutation.error instanceof ApiError ? deleteMutation.error.message : t("deleteError")}
        </p>
      )}
    </Card>
  );
}
