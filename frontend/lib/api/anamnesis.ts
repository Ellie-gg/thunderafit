import { apiFetch } from "./client";
import type { Anamnesis, AnamnesisInput } from "../types";

export function getOwnAnamnesis() {
  return apiFetch<{ anamnesis: Anamnesis | null }>("/api/anamnesis");
}

export function getAlunoAnamnesis(alunoId: string) {
  return apiFetch<{ anamnesis: Anamnesis }>(`/api/anamnesis?alunoId=${encodeURIComponent(alunoId)}`);
}

export function createAnamnesis(input: AnamnesisInput) {
  return apiFetch<{ anamnesis: Anamnesis }>("/api/anamnesis", { method: "POST", body: input });
}

export function updateAnamnesis(input: AnamnesisInput) {
  return apiFetch<{ anamnesis: Anamnesis }>("/api/anamnesis", { method: "PUT", body: input });
}
