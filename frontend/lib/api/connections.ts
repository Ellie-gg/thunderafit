import { apiFetch } from "./client";
import type { Specialty } from "@/lib/constants/professional-directory";

export interface ProfessionalPublic {
  id: string;
  email: string;
  role: "PERSONAL" | "NUTRICIONISTA";
  bio: string | null;
  city: string | null;
  state: string | null;
  specialties: Specialty[];
  avatarUrl: string | null;
  // Billing 3 degraus: nunca é "FREE" aqui (o backend já filtra quem aparece
  // no diretório) — só serve pro frontend destacar quem é PLUS.
  planoAssinatura: "FREE" | "BASE" | "PLUS";
}

export interface MyProfile {
  id: string;
  email: string;
  role: string;
  availableForNewStudents: boolean;
  bio: string | null;
  city: string | null;
  state: string | null;
  specialties: Specialty[];
  avatarUrl: string | null;
  planoAssinatura: "FREE" | "BASE" | "PLUS";
}

export type ConnectionStatus = "PENDENTE" | "ACEITA" | "RECUSADA";

export interface ConnectionRequestView {
  id: string;
  status: ConnectionStatus;
  professionalType: "PERSONAL" | "NUTRICIONISTA";
  createdAt: string;
  counterpart: { id: string; email: string; city: string | null; state: string | null; bio: string | null; avatarUrl: string | null };
}

// Fase 76: "Solicitar vínculo" virou "Enviar mensagem" — a 1ª mensagem do
// aluno cria a ConnectionRequest; os dois lados seguem conversando por essas
// mesmas rotas enquanto ela não for recusada.
export interface ConnectionMessageView {
  id: string;
  connectionRequestId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export function searchProfessionals(params?: { city?: string; state?: string; specialties?: Specialty[] }) {
  const qs = new URLSearchParams();
  if (params?.city) qs.set("city", params.city);
  if (params?.state) qs.set("state", params.state);
  if (params?.specialties?.length) qs.set("specialties", params.specialties.join(","));
  const query = qs.toString();
  return apiFetch<{ professionals: ProfessionalPublic[] }>(
    `/api/professionals/search${query ? `?${query}` : ""}`
  );
}

export function getMyProfile() {
  return apiFetch<{ profile: MyProfile }>("/api/professionals/me");
}

export function updateMyProfile(data: {
  availableForNewStudents?: boolean;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  specialties?: Specialty[];
}) {
  return apiFetch<{ profile: MyProfile }>("/api/professionals/me", { method: "PUT", body: data });
}

export function createConnectionRequest(professionalId: string, message: string) {
  return apiFetch<{ request: { id: string; status: ConnectionStatus } }>("/api/connection-requests", {
    method: "POST",
    body: { professionalId, message },
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

export function listConnectionMessages(requestId: string) {
  return apiFetch<{ messages: ConnectionMessageView[] }>(`/api/connection-requests/${requestId}/messages`);
}

export function sendConnectionMessage(requestId: string, body: string) {
  return apiFetch<{ message: ConnectionMessageView }>(`/api/connection-requests/${requestId}/messages`, {
    method: "POST",
    body: { body },
  });
}
