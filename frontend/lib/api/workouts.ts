import { apiFetch } from "./client";
import type {
  Exercise,
  SessionScheme,
  SetLog,
  Workout,
  WorkoutCompletionSummary,
  WorkoutProgram,
} from "../types";

export function listExercises(muscleGroup?: string) {
  const qs = muscleGroup ? `?muscleGroup=${encodeURIComponent(muscleGroup)}` : "";
  return apiFetch<{ exercises: Exercise[] }>(`/api/exercises${qs}`);
}

export function listMyWorkouts() {
  return apiFetch<{ workouts: Workout[] }>("/api/workouts");
}

export function getWorkout(workoutId: string) {
  return apiFetch<{ workout: Workout }>(`/api/workouts/${workoutId}`);
}

// Fase 36: a resposta também traz detecção de PR em tempo real (não usada em
// nenhuma tela ainda — só o contrato de dados, por ora).
export function createSetLog(
  workoutId: string,
  workoutExerciseId: string,
  input: { setNumber: number; repsDone: number; weightKg: number }
) {
  return apiFetch<{ setLog: SetLog; isPersonalRecord: boolean; previousBest: number | null }>(
    `/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`,
    { method: "POST", body: input }
  );
}

export function addWorkoutExercise(
  workoutId: string,
  input: {
    exerciseId: string;
    sets: number;
    repsRange: string;
    restSeconds: number;
    order: number;
    notes?: string;
  }
) {
  return apiFetch<{ workoutExercise: unknown }>(`/api/workouts/${workoutId}/exercises`, {
    method: "POST",
    body: input,
  });
}

// Fase 28: reordenar exercícios prescritos (setas ↑/↓).
export function moveWorkoutExercise(
  workoutId: string,
  workoutExerciseId: string,
  direction: "up" | "down"
) {
  return apiFetch<{ exercises: unknown[] }>(
    `/api/workouts/${workoutId}/exercises/${workoutExerciseId}/move`,
    { method: "POST", body: { direction } }
  );
}

// Fase 16 — Programas de Treino
// Fase 35: a resposta agora também traz o resumo pós-treino (volume,
// comparação com a sessão anterior, PRs).
export function completeWorkout(workoutId: string) {
  return apiFetch<{ workout: Workout; summary: WorkoutCompletionSummary }>(
    `/api/workouts/${workoutId}/complete`,
    { method: "POST" }
  );
}

// Fase 29: `alunoId` opcional — filtra pra só as instâncias aplicadas a um
// aluno específico (hub `/personal/alunos/[alunoId]`). Composto com `type`
// via URLSearchParams (não concatenação de string) porque os dois parâmetros
// agora podem vir juntos (`?type=instance&alunoId=...`) — a versão anterior
// só suportava um parâmetro por vez.
export function listWorkoutPrograms(type?: "template" | "instance", alunoId?: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (alunoId) params.set("alunoId", alunoId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<{ programs: WorkoutProgram[] }>(`/api/workout-programs${qs}`);
}

export function getWorkoutProgram(programId: string) {
  return apiFetch<{ program: WorkoutProgram }>(`/api/workout-programs/${programId}`);
}

export function createWorkoutProgram(name: string, sessionScheme?: SessionScheme) {
  return apiFetch<{ program: WorkoutProgram }>("/api/workout-programs", {
    method: "POST",
    body: { name, sessionScheme },
  });
}

// "Montagem Inteligente": motor de regras determinístico (sem IA), devolve
// só um rascunho — nada é persistido nesta chamada. `level` não é coletado
// no modal (fiel ao pedido de "3 campos simples"); o backend usa
// "intermediario" como padrão quando omitido.
export type WorkoutGoal = "hipertrofia" | "forca" | "resistencia";

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
  order: number;
}

export function generateWorkoutDraft(input: { muscleGroups: string[]; goal: WorkoutGoal }) {
  return apiFetch<{ exercises: GeneratedExercise[] }>("/api/workouts/generate", {
    method: "POST",
    body: input,
  });
}

export function addProgramSession(programId: string, input: { letter: string; name?: string }) {
  return apiFetch<{ session: Workout }>(`/api/workout-programs/${programId}/sessions`, {
    method: "POST",
    body: input,
  });
}

export function applyProgram(programId: string, alunoId: string) {
  return apiFetch<{ program: WorkoutProgram }>(`/api/workout-programs/${programId}/apply`, {
    method: "POST",
    body: { alunoId },
  });
}

// Fase 34.5: "Meu treino pessoal" — catálogo de templates SELF (curados pelo
// admin) e aplicação (cópia) direto pelo próprio aluno, sem Personal.
export function listSelfTemplates() {
  return apiFetch<{ programs: WorkoutProgram[] }>("/api/workout-programs/self-templates");
}

// Fase 52: "1 treino pessoal ativo por vez" — sem `replace`, um 2º apply
// enquanto já existe um ativo devolve 409 (`ApiError.data.code ===
// "SELF_PROGRAM_EXISTS"`, com `existingProgramId`/`existingProgramName`) em
// vez de lançar a exceção genérica; quem chama decide se mostra um diálogo
// de confirmação e tenta de novo com `replace: true`.
export function applySelfTemplate(programId: string, replace?: boolean) {
  return apiFetch<{ program: WorkoutProgram }>(
    `/api/workout-programs/${programId}/apply-self-template`,
    { method: "POST", body: replace ? { replace: true } : undefined }
  );
}

// Fase 31: apaga um programa (template ou instância aplicada) — sem volta,
// por isso todo lugar que usa isto exige confirmação antes de chamar
// (ver DeleteProgramButton).
export function deleteWorkoutProgram(programId: string) {
  return apiFetch<Record<string, never>>(`/api/workout-programs/${programId}`, {
    method: "DELETE",
  });
}
