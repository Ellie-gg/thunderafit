import { apiFetch } from "./client";

export function sendContactMessage(title: string, message: string) {
  return apiFetch<{ id: string; emailSent: boolean }>("/api/contact", {
    method: "POST",
    body: { title, message },
  });
}
