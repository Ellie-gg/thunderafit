import { apiFetch } from "./client";
import type { Exercise, SetLog, Workout } from "../types";

export function listExercises() {
  return apiFetch<{ exercises: Exercise[] }>("/api/exercises");
}

export function listMyWorkouts() {
  return apiFetch<{ workouts: Workout[] }>("/api/workouts");
}

export function getWorkout(workoutId: string) {
  return apiFetch<{ workout: Workout }>(`/api/workouts/${workoutId}`);
}

export function createSetLog(
  workoutId: string,
  workoutExerciseId: string,
  input: { setNumber: number; repsDone: number; weightKg: number }
) {
  return apiFetch<{ setLog: SetLog }>(
    `/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`,
    { method: "POST", body: input }
  );
}

export function createWorkout(input: { alunoId: string; name: string; letter: string }) {
  return apiFetch<{ workout: Workout }>("/api/workouts", { method: "POST", body: input });
}

export function addWorkoutExercise(
  workoutId: string,
  input: { exerciseId: string; sets: number; repsRange: string; restSeconds: number; order: number }
) {
  return apiFetch<{ workoutExercise: unknown }>(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    body: input,
  });
}
