import { apiFetch } from "./client";

export interface RelationAluno {
  id: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  paymentReminderDueDate: string | null;
  paymentReminderRecurring: boolean;
}

export function listRelations() {
  return apiFetch<{ relations: RelationAluno[] }>("/api/relations");
}

export function createRelation(alunoId: string) {
  return apiFetch<{ relation: unknown }>("/api/relations", {
    method: "POST",
    body: { alunoId },
  });
}

/** Fase 103 — desvincular um aluno. Preserva o histórico de treino dele. */
export function removeRelation(alunoId: string) {
  return apiFetch<void>(`/api/relations/${alunoId}`, { method: "DELETE" });
}

/** Personal configura (ou desativa, com dueDate null) o lembrete de pagamento do vínculo. */
export function setPaymentReminder(alunoId: string, dueDate: string | null, recurring: boolean) {
  return apiFetch<{ relation: unknown }>(`/api/relations/${alunoId}/payment-reminder`, {
    method: "PUT",
    body: { dueDate, recurring },
  });
}

export function lookupAlunoByEmail(email: string) {
  return apiFetch<{ user: { id: string; email: string; role: string } }>(
    `/api/users/lookup?email=${encodeURIComponent(email)}`
  );
}
