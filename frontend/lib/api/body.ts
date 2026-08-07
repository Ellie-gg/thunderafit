import { apiFetch } from "./client";

// Fase 121: histórico de medições corporais. Existe porque `Anamnesis` é 1:1 com
// o aluno (snapshot sobrescrito) — esta é a série temporal.
export interface BodyMeasurement {
  id: string;
  measuredAt: string;
  weightKg: number;
  waistCm: number | null;
  bodyFatPercent: number | null;
  /** Quem lançou: o aluno em casa, ou o profissional na avaliação presencial. */
  recordedByRole: "ALUNO" | "PERSONAL" | "NUTRICIONISTA" | "ADMIN";
}

export interface BodyMeasurementsResponse {
  measurements: BodyMeasurement[];
}

export interface BodyMeasurementInput {
  weightKg: string;
  waistCm?: string;
  bodyFatPercent?: string;
  measuredAt?: string;
}

/** `alunoId` só é usado por profissional/admin — o aluno sempre lê o próprio. */
export function listBodyMeasurements(alunoId?: string) {
  const qs = alunoId ? `?alunoId=${encodeURIComponent(alunoId)}` : "";
  return apiFetch<BodyMeasurementsResponse>(`/api/body-measurements${qs}`);
}

export function createBodyMeasurement(input: BodyMeasurementInput, alunoId?: string) {
  const qs = alunoId ? `?alunoId=${encodeURIComponent(alunoId)}` : "";
  return apiFetch<{ measurement: BodyMeasurement }>(`/api/body-measurements${qs}`, {
    method: "POST",
    body: input,
  });
}

export function deleteBodyMeasurement(id: string) {
  return apiFetch<{ ok: true }>(`/api/body-measurements/${id}`, { method: "DELETE" });
}
