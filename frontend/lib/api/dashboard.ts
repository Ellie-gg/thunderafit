import { apiFetch } from "./client";
import type { WorkoutProgram, DietPlanDetail } from "../types";

// Fase 96 (triagem de perf 2026-07-29) — substitui o waterfall de rede do
// dashboard do aluno (lista → detalhe do programa do Personal, lista →
// detalhe do programa próprio, lista → detalhe do plano de dieta ativo) por
// um único round trip; ver src/dashboard/services/dashboard.service.ts.
export interface AlunoDashboardSummary {
  personalProgram: WorkoutProgram | null;
  selfProgram: WorkoutProgram | null;
  dietPlan: DietPlanDetail | null;
}

export function getAlunoDashboardSummary() {
  return apiFetch<AlunoDashboardSummary>("/api/dashboard/aluno-summary");
}
