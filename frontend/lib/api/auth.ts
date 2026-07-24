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

export function registerRequest(email: string, password: string, role: Role, name: string) {
  return apiFetch<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: { email, password, role, name },
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

// Fase 30: foto de perfil. `null` remove o avatar.
export function updateAvatarRequest(avatarDataUrl: string | null) {
  return apiFetch<{ user: User }>("/api/auth/me/avatar", {
    method: "PUT",
    body: { avatarDataUrl },
  });
}

// i18n: escolha explícita de idioma — sincroniza entre dispositivos. `null` volta à detecção automática.
export function updateLocaleRequest(locale: "PT" | "EN" | "ES" | null) {
  return apiFetch<{ user: User }>("/api/auth/me/locale", {
    method: "PUT",
    body: { locale },
  });
}
