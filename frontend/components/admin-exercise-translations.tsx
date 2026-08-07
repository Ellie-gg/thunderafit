"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getExerciseTranslations, updateExerciseTranslations } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/query-error";

type Campos = { name: string; muscleGroup: string; description: string };
const VAZIO: Campos = { name: "", muscleGroup: "", description: "" };

/**
 * Fase 121 (levantamento do roadmap): edição das traduções EN/ES de um
 * exercício pela UI de admin.
 *
 * Antes `ExerciseTranslation` só era populada por **script de seed rodado à
 * mão** — a tela `/nimbus/exercicios` não tinha nenhum campo de tradução, então
 * todo exercício cadastrado por aqui nascia só em português e um usuário em
 * EN/ES via o texto PT cru (o fallback do `exercise-translation.service.ts`
 * nunca quebra, mas sub-traduz em silêncio). Traduzir exigia um dev.
 *
 * Mostra o PT ao lado como referência (o PT canônico vive no próprio
 * `Exercise`, nunca como linha de tradução). Locale deixado inteiramente em
 * branco = "não mandei": o backend preserva o que já estava salvo, não apaga.
 */
export function AdminExerciseTranslations({ exerciseId }: { exerciseId: string }) {
  const t = useTranslations("adminExerciseTranslations");
  const tCommon = useTranslations("common");
  const [en, setEn] = useState<Campos | null>(null);
  const [es, setEs] = useState<Campos | null>(null);
  const [salvo, setSalvo] = useState(false);

  const query = useQuery({
    queryKey: ["admin-exercise-translations", exerciseId],
    queryFn: () => getExerciseTranslations(exerciseId),
  });

  // `en`/`es` em `null` = "o admin ainda não editou este locale", então o valor
  // exibido vem do servidor. DERIVADO em vez de semeado com `setState` no
  // render (que dispararia re-render em cascata) ou num efeito — o projeto tem
  // regra de lint contra `setState` em efeito, e aqui simplesmente não precisa
  // de estado até a primeira digitação.
  const dados = query.data;
  const enValor = en ?? dados?.EN ?? VAZIO;
  const esValor = es ?? dados?.ES ?? VAZIO;

  const mutation = useMutation({
    mutationFn: () =>
      updateExerciseTranslations(exerciseId, { EN: enValor, ES: esValor }),
    onSuccess: (data) => {
      setEn(data.EN ?? VAZIO);
      setEs(data.ES ?? VAZIO);
      setSalvo(true);
      query.refetch();
    },
  });

  if (query.isLoading) return <p className="text-xs text-muted">{tCommon("loading")}</p>;
  if (query.isError) {
    return <QueryError error={query.error} onRetry={() => query.refetch()} />;
  }

  function campos(
    locale: "EN" | "ES",
    valor: Campos,
    setValor: (c: Campos) => void
  ) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
          {locale}
        </p>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`tr-${locale}-name-${exerciseId}`}>{t("nameLabel")}</Label>
          <Input
            id={`tr-${locale}-name-${exerciseId}`}
            value={valor.name}
            onChange={(e) => {
              setSalvo(false);
              setValor({ ...valor, name: e.target.value });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`tr-${locale}-mg-${exerciseId}`}>{t("muscleGroupLabel")}</Label>
          <Input
            id={`tr-${locale}-mg-${exerciseId}`}
            value={valor.muscleGroup}
            onChange={(e) => {
              setSalvo(false);
              setValor({ ...valor, muscleGroup: e.target.value });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`tr-${locale}-desc-${exerciseId}`}>{t("descriptionLabel")}</Label>
          <textarea
            id={`tr-${locale}-desc-${exerciseId}`}
            value={valor.description}
            rows={3}
            onChange={(e) => {
              setSalvo(false);
              setValor({ ...valor, description: e.target.value });
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-sm font-bold">{t("title")}</h3>
        <p className="text-xs text-muted">{t("hint")}</p>
      </div>

      {/* PT como referência, somente leitura — o canônico vive no Exercise. */}
      {dados && (
        <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wide">PT</span>{" "}
          {dados.pt.name} · {dados.pt.muscleGroup}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {campos("EN", enValor, setEn)}
        {campos("ES", esValor, setEs)}
      </div>

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("saveError")}
        </p>
      )}
      {salvo && !mutation.isPending && <p className="text-sm text-success">{t("saved")}</p>}

      <Button
        type="button"
        className="self-start"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
