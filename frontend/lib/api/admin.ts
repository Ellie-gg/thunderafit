import { apiFetch } from "./client";
import type {
  AdminOverview,
  AdminUsersResponse,
  AdminLoginLogEntry,
  AdminSupportSlaThread,
  AdminAccessLogEntry,
  AdminAuditLogEntry,
  AdminExerciseInput,
  AdminExerciseMutationResult,
  Anamnesis,
  Exercise,
  ExerciseMediaType,
  Role,
  SelfTemplateCategory,
  SessionScheme,
  Workout,
  WorkoutExercise,
  WorkoutProgram,
} from "../types";

export function getAdminOverview() {
  return apiFetch<AdminOverview>("/api/admin/overview");
}

export function listAdminUsers(params: { role?: string; page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams();
  if (params.role) query.set("role", params.role);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export function listAdminLogins() {
  return apiFetch<{ logins: AdminLoginLogEntry[] }>("/api/admin/logins");
}

export function getAdminSupportSla() {
  return apiFetch<{ threads: AdminSupportSlaThread[] }>("/api/admin/support-sla");
}

export function listAdminAccessLogs() {
  return apiFetch<{ logs: AdminAccessLogEntry[]; auditLogs: AdminAuditLogEntry[] }>(
    "/api/admin/access-logs"
  );
}

// --- Fase 33: CRUD do catálogo de exercícios ---

export function listAdminExercises() {
  return apiFetch<{ exercises: Exercise[] }>("/api/admin/exercises");
}

export function createAdminExercise(input: AdminExerciseInput) {
  return apiFetch<AdminExerciseMutationResult>("/api/admin/exercises", {
    method: "POST",
    body: input,
  });
}

export function updateAdminExercise(id: string, input: AdminExerciseInput) {
  return apiFetch<AdminExerciseMutationResult>(`/api/admin/exercises/${id}`, {
    method: "PUT",
    body: input,
  });
}

export function deleteAdminExercise(id: string) {
  return apiFetch<{ deleted: true }>(`/api/admin/exercises/${id}`, { method: "DELETE" });
}

export function updateAdminExerciseMedia(
  id: string,
  input: { mediaType: ExerciseMediaType; mediaDataUrl?: string; youtubeUrl?: string }
) {
  return apiFetch<{ exercise: Exercise }>(`/api/admin/exercises/${id}/media`, {
    method: "PUT",
    body: input,
  });
}

// --- Fase 33: edição de role de usuário ---

export function updateUserRole(id: string, role: Role) {
  return apiFetch<{ user: { id: string; role: Role } }>(`/api/admin/users/${id}/role`, {
    method: "PUT",
    body: { role },
  });
}

/** Reaproveita GET /api/anamnesis?alunoId= — o backend já aceita ADMIN e audita o acesso. */
export function getAlunoAnamnesisAsAdmin(alunoId: string) {
  return apiFetch<{ anamnesis: Anamnesis }>(`/api/anamnesis?alunoId=${encodeURIComponent(alunoId)}`);
}

// --- Fase 34.5: curadoria de templates SELF ("Meu treino pessoal") ---

export function listAdminSelfTemplates() {
  return apiFetch<{ programs: WorkoutProgram[] }>("/api/admin/self-templates");
}

export function getAdminSelfTemplate(programId: string) {
  return apiFetch<{ program: WorkoutProgram }>(`/api/admin/self-templates/${programId}`);
}

export function createAdminSelfTemplate(
  name: string,
  sessionScheme?: SessionScheme,
  category?: SelfTemplateCategory
) {
  return apiFetch<{ program: WorkoutProgram }>("/api/admin/self-templates", {
    method: "POST",
    body: { name, sessionScheme, category },
  });
}

// Fase 52: banner do carrossel de "Meu Treino Pessoal" — `bannerDataUrl: null`
// remove o banner (o card volta pro fallback estático só-com-nome).
export function uploadAdminSelfTemplateBanner(programId: string, bannerDataUrl: string | null) {
  return apiFetch<{ program: WorkoutProgram }>(`/api/admin/self-templates/${programId}/banner`, {
    method: "PUT",
    body: { bannerDataUrl },
  });
}

export function addSessionToAdminSelfTemplate(programId: string, letter: string) {
  return apiFetch<{ session: Workout }>(`/api/admin/self-templates/${programId}/sessions`, {
    method: "POST",
    body: { letter },
  });
}

export function addExerciseToAdminSelfSession(
  programId: string,
  sessionId: string,
  input: { exerciseId: string; sets: number; repsRange: string; restSeconds: number; order: number; notes?: string }
) {
  return apiFetch<{ workoutExercise: WorkoutExercise }>(
    `/api/admin/self-templates/${programId}/sessions/${sessionId}/exercises`,
    { method: "POST", body: input }
  );
}

export function deleteAdminSelfTemplate(programId: string) {
  return apiFetch<Record<string, never>>(`/api/admin/self-templates/${programId}`, {
    method: "DELETE",
  });
}
