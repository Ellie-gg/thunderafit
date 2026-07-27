import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 66 — dashboard do Personal redesenhado a partir de um mockup do
 * fundador: 2 cards de ação clara ("Biblioteca de Templates" e "Meus
 * Alunos", este com um acesso rápido embutido pra "Dúvidas de alunos"
 * refletindo a contagem real de threads pendentes — sem endpoint novo,
 * conta client-side a partir da mesma listagem que /personal/duvidas usa).
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

async function backendJson(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

test("dashboard do Personal mostra os 2 cards do novo layout e a contagem real de dúvidas pendentes", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_dashredesign_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_dashredesign_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const subject = `Dúvida Dashboard E2E ${stamp}`;

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  const personalReg = await backendJson("/api/auth/register", {
    email: personalEmail,
    password,
    role: "PERSONAL",
  });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // --- Card "Biblioteca de Templates" ---
  await expect(page.getByRole("heading", { name: "📋 Biblioteca de Templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "⚡ Explorar Templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ou monte um programa do zero →" })).toBeVisible();

  // --- Card "Meus Alunos" ---
  await expect(page.getByRole("heading", { name: "👥 Meus Alunos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Vincular Novo Aluno" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gerenciar alunos →" })).toBeVisible();

  // --- "Dúvidas de alunos": sem pendências ainda ---
  await expect(page.getByRole("link", { name: "💬 Dúvidas de alunos", exact: true })).toBeVisible();

  // --- Aluno faz uma pergunta → thread nasce ABERTO (pendente) ---
  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  await backendJson(
    "/api/support/threads",
    { personalId: personalReg.user.id, subject, message: "Oi, tenho uma dúvida" },
    alunoLogin.accessToken
  );

  await page.reload();
  await expect(page.getByRole("link", { name: "💬 Dúvidas de alunos (1 pendente)" })).toBeVisible({
    timeout: 15000,
  });
});
