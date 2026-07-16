import { apiFetch } from "./client";
import type { PersonalOption, SupportThread } from "../types";

export function listMyPersonals() {
  return apiFetch<{ personals: PersonalOption[] }>("/api/support/my-personals");
}

export function listThreads() {
  return apiFetch<{ threads: SupportThread[] }>("/api/support/threads");
}

export function getThread(id: string) {
  return apiFetch<{ thread: SupportThread }>(`/api/support/threads/${id}`);
}

export function createThread(input: { personalId: string; subject: string; message: string }) {
  return apiFetch<{ thread: SupportThread }>("/api/support/threads", { method: "POST", body: input });
}

export function addThreadMessage(threadId: string, text: string) {
  return apiFetch<{ message: unknown }>(`/api/support/threads/${threadId}/messages`, {
    method: "POST",
    body: { text },
  });
}
