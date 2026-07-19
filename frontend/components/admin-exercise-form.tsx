"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createAdminExercise,
  updateAdminExercise,
  updateAdminExerciseMedia,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import type { Exercise, ExerciseMediaType, DifficultyLevel } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const NEW_CATEGORY_OPTION = "__new__";

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyLevel; label: string }> = [
  { value: "INICIANTE", label: "Iniciante" },
  { value: "INTERMEDIARIO", label: "Intermediário" },
  { value: "AVANCADO", label: "Avançado" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Fase 33: formulário de criação/edição do catálogo de exercícios.
 *
 * Bugs potenciais considerados antes de escrever este componente:
 * - reenviar automaticamente com confirmSimilarName=true sem o admin ver a
 *   lista de nomes parecidos — o aviso existe justamente pra dar chance de
 *   cancelar, então o segundo envio exige um clique explícito novo.
 * - chamar o endpoint de mídia mesmo quando o admin não mexeu nela nesta
 *   edição — só dispara se um arquivo novo foi escolhido ou o link do
 *   YouTube foi preenchido/alterado nesta sessão do formulário.
 */
export function AdminExerciseForm({
  exercise,
  categories,
  onSaved,
  onCancel,
}: {
  /** Ausente = modo criação. */
  exercise?: Exercise;
  categories: string[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? "");
  const [category, setCategory] = useState(
    exercise && !categories.includes(exercise.muscleGroup) ? NEW_CATEGORY_OPTION : exercise?.muscleGroup ?? categories[0] ?? NEW_CATEGORY_OPTION
  );
  const [newCategory, setNewCategory] = useState(
    exercise && !categories.includes(exercise.muscleGroup) ? exercise.muscleGroup : ""
  );
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [description, setDescription] = useState(exercise?.description ?? "");
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(
    exercise?.difficultyLevel ?? "INTERMEDIARIO"
  );
  const [mediaType, setMediaType] = useState<ExerciseMediaType>(exercise?.mediaType ?? "YOUTUBE");
  const [youtubeUrl, setYoutubeUrl] = useState(
    exercise?.mediaType === "YOUTUBE" ? exercise?.mediaUrl ?? "" : ""
  );
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [similarNames, setSimilarNames] = useState<string[] | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const effectiveCategory = category === NEW_CATEGORY_OPTION ? newCategory.trim() : category;

  const mutation = useMutation({
    mutationFn: async (confirmSimilarName: boolean) => {
      const input = {
        name: name.trim(),
        muscleGroup: effectiveCategory,
        equipment: equipment.trim(),
        description: description.trim(),
        difficultyLevel,
        confirmSimilarName,
      };
      const result = exercise
        ? await updateAdminExercise(exercise.id, input)
        : await createAdminExercise(input);

      if ("warning" in result && result.warning === "similar_name") {
        return result;
      }

      const savedExercise = result.exercise!;

      // Só mexe em mídia se o admin de fato preencheu algo nesta sessão do
      // formulário — evita sobrescrever a mídia existente com um campo
      // vazio sem querer.
      if (mediaType === "YOUTUBE" && youtubeUrl.trim()) {
        await updateAdminExerciseMedia(savedExercise.id, { mediaType, youtubeUrl: youtubeUrl.trim() });
      } else if ((mediaType === "VIDEO" || mediaType === "GIF") && mediaFile) {
        const mediaDataUrl = await fileToDataUrl(mediaFile);
        await updateAdminExerciseMedia(savedExercise.id, { mediaType, mediaDataUrl });
      }

      return result;
    },
    onSuccess: (result) => {
      if ("warning" in result && result.warning === "similar_name") {
        setSimilarNames(result.similarNames);
        return;
      }
      setSimilarNames(null);
      onSaved?.();
    },
    onError: (err) => {
      setLocalError(err instanceof ApiError ? err.message : "Erro ao processar o arquivo de mídia.");
    },
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError(null);
        mutation.mutate(false);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ex-name">Nome</Label>
        <Input id="ex-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-category">Categoria (grupo muscular)</Label>
          <select
            id="ex-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY_OPTION}>+ Nova categoria...</option>
          </select>
          {category === NEW_CATEGORY_OPTION && (
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nome da nova categoria"
              required
              className="mt-1"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-equipment">Equipamento</Label>
          <Input
            id="ex-equipment"
            required
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ex-description">Descrição</Label>
        <textarea
          id="ex-description"
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ex-difficulty">Dificuldade</Label>
        <select
          id="ex-difficulty"
          value={difficultyLevel}
          onChange={(e) => setDifficultyLevel(e.target.value as DifficultyLevel)}
          className="h-11 w-fit rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <Label>Mídia {exercise ? "(deixe em branco pra manter a atual)" : "(opcional)"}</Label>
        <div className="flex gap-2">
          {(["YOUTUBE", "VIDEO", "GIF"] as ExerciseMediaType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setMediaType(type);
                setMediaFile(null);
              }}
              aria-pressed={mediaType === type}
              className={
                mediaType === type
                  ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent"
              }
            >
              {type}
            </button>
          ))}
        </div>
        {mediaType === "YOUTUBE" ? (
          <Input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        ) : (
          <input
            type="file"
            accept={mediaType === "VIDEO" ? "video/mp4,video/webm" : "image/gif"}
            onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted"
          />
        )}
      </div>

      {similarNames && (
        <div className="rounded-md border border-accent-secondary/40 bg-accent-secondary/10 p-3">
          <p className="text-sm text-foreground">
            Já existe(m) exercício(s) com nome parecido: <strong>{similarNames.join(", ")}</strong>.
            Salvar mesmo assim?
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={() => setSimilarNames(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              Salvar mesmo assim
            </Button>
          </div>
        </div>
      )}

      {(localError || mutation.isError) && !similarNames && (
        <p className="text-sm text-danger">{localError ?? "Erro ao salvar exercício."}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
