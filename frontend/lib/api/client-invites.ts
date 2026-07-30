import { apiFetch } from "./client";

export interface ClientInvite {
  id: string;
  personalId: string;
  professionalType: "PERSONAL" | "NUTRICIONISTA";
  label: string;
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
  consumedByAlunoId: string | null;
}

/** `token` só vem UMA vez, nesta resposta — nunca é possível recuperá-lo depois. */
export function createClientInvite(label: string) {
  return apiFetch<{ invite: ClientInvite; token: string }>("/api/client-invites", {
    method: "POST",
    body: { label },
  });
}

export function listClientInvites() {
  return apiFetch<{ invites: ClientInvite[] }>("/api/client-invites");
}

export function revokeClientInvite(id: string) {
  return apiFetch<void>(`/api/client-invites/${id}`, { method: "DELETE" });
}

export interface ClientInvitePreview {
  valid: boolean;
  professionalName?: string;
  professionalType?: "PERSONAL" | "NUTRICIONISTA";
}

/** Pública — chamada pela tela de login/cadastro antes de existir sessão. */
export function previewClientInvite(token: string) {
  return apiFetch<ClientInvitePreview>(
    `/api/client-invites/preview?token=${encodeURIComponent(token)}`,
    { auth: false }
  );
}

/**
 * Fase 104 (correção pós-lançamento) — consome o convite pra quem JÁ ESTÁ
 * LOGADO no momento em que abre o link (achado real: sem isso, essa pessoa
 * via o formulário de login/cadastro de novo, e se não completasse aquele
 * fluxo especificamente, o vínculo nunca acontecia — aluno "órfão").
 */
export function consumeClientInvite(token: string) {
  return apiFetch<{ consumed: true }>("/api/client-invites/consume", {
    method: "POST",
    body: { token },
  });
}
