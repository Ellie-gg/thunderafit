import { apiFetch } from "./client";
import type {
  AdminOverview,
  AdminUsersResponse,
  AdminLoginLogEntry,
  AdminSupportSlaThread,
  AdminAccessLogEntry,
  Anamnesis,
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
  return apiFetch<{ logs: AdminAccessLogEntry[] }>("/api/admin/access-logs");
}

/** Reaproveita GET /api/anamnesis?alunoId= — o backend já aceita ADMIN e audita o acesso. */
export function getAlunoAnamnesisAsAdmin(alunoId: string) {
  return apiFetch<{ anamnesis: Anamnesis }>(`/api/anamnesis?alunoId=${encodeURIComponent(alunoId)}`);
}
