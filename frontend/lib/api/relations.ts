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
