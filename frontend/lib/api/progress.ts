import { apiFetch } from "./client";
import type { LoggedExercise, LoadHistoryResponse, FrequencyResponse } from "../types";

export function listLoggedExercises() {
  return apiFetch<{ exercises: LoggedExercise[] }>("/api/progress/exercises");
}

export function getLoadHistory(exerciseId: string) {
  return apiFetch<LoadHistoryResponse>(
    `/api/progress/load-history?exerciseId=${encodeURIComponent(exerciseId)}`
  );
}

export function getFrequency(period: string = "6m") {
  return apiFetch<FrequencyResponse>(`/api/progress/frequency?period=${encodeURIComponent(period)}`);
}
