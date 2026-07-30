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

// Fase 104: `inviteToken` opcional — presente quando o cadastro veio de um
// link de convite (`/login?invite=...`), consumido no backend só se
// role === "ALUNO" (o vínculo automático acontece na mesma chamada).
export function registerRequest(
  email: string,
  password: string,
  role: Role,
  name: string,
  inviteToken?: string
) {
  return apiFetch<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: { email, password, role, name, inviteToken },
    auth: false,
  });
}

// Fase 104: `inviteToken` cobre quem clica no link do convite mas JÁ tinha
// conta (login em vez de cadastro) — mesmo vínculo automático.
export function loginRequest(email: string, password: string, inviteToken?: string) {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password, inviteToken },
    auth: false,
  });
}

type GoogleAuthResponse = { needsRole: true; email: string } | ({ needsRole: false } & AuthResponse);

// Fase 77 — SSO Google. Sem `role`: login se a conta já existir, ou
// `{ needsRole: true }` se for a 1ª vez desse e-mail (ainda não cria nada).
// Com `role`: finaliza a criação da conta nova. Fase 104: `inviteToken` cobre
// os dois casos, mesmo padrão de registerRequest/loginRequest acima.
export function googleAuthRequest(idToken: string, role?: Role, inviteToken?: string) {
  return apiFetch<GoogleAuthResponse>("/api/auth/google", {
    method: "POST",
    body: { idToken, role, inviteToken },
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

// Fase 81 — confirmação de e-mail.
export function resendVerificationEmailRequest() {
  return apiFetch<{ message: string }>("/api/auth/resend-verification", { method: "POST" });
}

export function verifyEmailRequest(uid: string, token: string) {
  return apiFetch<{ user: User }>("/api/auth/verify-email", {
    method: "POST",
    body: { uid, token },
    auth: false,
  });
}

// Fase 81 — "esqueci minha senha". Resposta sempre genérica (mesma mensagem
// exista ou não o e-mail) — não há distinção de sucesso/falha aqui de propósito.
export function forgotPasswordRequest(email: string) {
  return apiFetch<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export function resetPasswordRequest(uid: string, token: string, newPassword: string) {
  return apiFetch<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: { uid, token, newPassword },
    auth: false,
  });
}

// Fase 81 — "Excluir minha conta". `password` omitido só é válido pra conta
// só-Google (sem senha própria) — o backend exige se `passwordHash` existir.
export function deleteMyAccountRequest(password?: string) {
  return apiFetch<{ ok: boolean }>("/api/auth/me", {
    method: "DELETE",
    body: { password },
  });
}
