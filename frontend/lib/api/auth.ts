import { apiFetch } from "./client";
import type { Role, User } from "../types";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export function checkEmailRequest(email: string) {
  return apiFetch<{ exists: boolean }>("/api/auth/check-email", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export function registerRequest(email: string, password: string, role: Role) {
  return apiFetch<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: { email, password, role },
    auth: false,
  });
}

export function loginRequest(email: string, password: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function logoutRequest() {
  return apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" });
}
