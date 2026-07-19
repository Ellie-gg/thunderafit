import { apiFetch } from "./client";

export interface RelationAluno {
  id: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
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

export function lookupAlunoByEmail(email: string) {
  return apiFetch<{ user: { id: string; email: string; role: string } }>(
    `/api/users/lookup?email=${encodeURIComponent(email)}`
  );
}
