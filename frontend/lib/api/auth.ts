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

type GoogleAuthResponse = { needsRole: true; email: string } | ({ needsRole: false } & AuthResponse);

// Fase 77 — SSO Google. Sem `role`: login se a conta já existir, ou
// `{ needsRole: true }` se for a 1ª vez desse e-mail (ainda não cria nada).
// Com `role`: finaliza a criação da conta nova.
export function googleAuthRequest(idToken: string, role?: Role) {
  return apiFetch<GoogleAuthResponse>("/api/auth/google", {
    method: "POST",
    body: { idToken, role },
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

// Fase 80 — "Trocar senha" no perfil. `currentPassword` omitido é só válido
// pra uma conta que ainda não tem senha própria (Google SSO) — o backend
// rejeita com 400 se for obrigatória e vier ausente.
export function changePasswordRequest(currentPassword: string | undefined, newPassword: string) {
  return apiFetch<{ user: User }>("/api/auth/me/password", {
    method: "PUT",
    body: { currentPassword, newPassword },
  });
}
