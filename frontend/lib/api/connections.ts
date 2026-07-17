import { apiFetch } from "./client";

export interface ProfessionalPublic {
  id: string;
  email: string;
  role: "PERSONAL" | "NUTRICIONISTA";
  location: string | null;
  bio: string | null;
}

export interface MyProfile {
  id: string;
  email: string;
  role: string;
  availableForNewStudents: boolean;
  location: string | null;
  bio: string | null;
}

export type ConnectionStatus = "PENDENTE" | "ACEITA" | "RECUSADA";

export interface ConnectionRequestView {
  id: string;
  status: ConnectionStatus;
  professionalType: "PERSONAL" | "NUTRICIONISTA";
  createdAt: string;
  counterpart: { id: string; email: string; location: string | null; bio: string | null };
}

export function searchProfessionals(location?: string) {
  const qs = location ? `?location=${encodeURIComponent(location)}` : "";
  return apiFetch<{ professionals: ProfessionalPublic[] }>(`/api/professionals/search${qs}`);
}

export function getMyProfile() {
  return apiFetch<{ profile: MyProfile }>("/api/professionals/me");
}

export function updateMyProfile(data: {
  availableForNewStudents?: boolean;
  location?: string | null;
  bio?: string | null;
}) {
  return apiFetch<{ profile: MyProfile }>("/api/professionals/me", { method: "PUT", body: data });
}

export function createConnectionRequest(professionalId: string) {
  return apiFetch<{ request: unknown }>("/api/connection-requests", {
    method: "POST",
    body: { professionalId },
  });
}

export function listConnectionRequests() {
  return apiFetch<{ requests: ConnectionRequestView[] }>("/api/connection-requests");
}

export function acceptConnectionRequest(id: string) {
  return apiFetch<{ request: unknown }>(`/api/connection-requests/${id}/accept`, { method: "POST" });
}

export function rejectConnectionRequest(id: string) {
  return apiFetch<{ request: unknown }>(`/api/connection-requests/${id}/reject`, { method: "POST" });
}
