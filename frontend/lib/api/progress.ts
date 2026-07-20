import { apiFetch } from "./client";
import type { LoggedExercise, LoadHistoryResponse, FrequencyResponse, WeeklySummaryResponse } from "../types";

// Fase 29: as 3 funções abaixo ganham `alunoId` opcional — usado pelo hub do
// Personal (`/personal/alunos/[alunoId]`) pra ver a evolução de um aluno
// vinculado. Sem esse parâmetro, comportamento idêntico ao de antes (o
// backend cai no próprio usuário autenticado).
//
// Bugs potenciais considerados antes de escrever:
// - montar a query string concatenando "&" quando não há "?" ainda (aqui não
//   se aplica: cada endpoint já tem no máximo um outro parâmetro opcional,
//   então basta decidir "?" vs "&" por qual veio primeiro).
// - esquecer `encodeURIComponent` no alunoId (é um UUID, mas mantém o mesmo
//   cuidado dos outros parâmetros deste arquivo, por consistência).
// - deixar `?alunoId=undefined` vazar na URL quando o parâmetro não é
//   passado — construído condicionalmente, nunca com template string direto.

export function listLoggedExercises(alunoId?: string) {
  const qs = alunoId ? `?alunoId=${encodeURIComponent(alunoId)}` : "";
  return apiFetch<{ exercises: LoggedExercise[] }>(`/api/progress/exercises${qs}`);
}

export function getLoadHistory(exerciseId: string, alunoId?: string) {
  const params = new URLSearchParams({ exerciseId });
  if (alunoId) params.set("alunoId", alunoId);
  return apiFetch<LoadHistoryResponse>(`/api/progress/load-history?${params.toString()}`);
}

export function getFrequency(period: string = "6m", alunoId?: string) {
  const params = new URLSearchParams({ period });
  if (alunoId) params.set("alunoId", alunoId);
  return apiFetch<FrequencyResponse>(`/api/progress/frequency?${params.toString()}`);
}

export function getWeeklySummary(alunoId?: string) {
  const qs = alunoId ? `?alunoId=${encodeURIComponent(alunoId)}` : "";
  return apiFetch<WeeklySummaryResponse>(`/api/progress/weekly-summary${qs}`);
}
