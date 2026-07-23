import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 24 (Parte 2) — fluxo unificado de auth, ponta a ponta: substitui o
 * antigo selecao-perfil-flow.spec.ts (que testava os boxes Personal/Aluno em
 * "/" + /register?role=X, ambos removidos nesta fase). Cobre: "/" sem sessão
 * manda pra /login; e-mail novo → escolha de papel (Treinar antes de
 * Personal, Nutricionista ausente) → cadastro completo; e-mail já cadastrado
 * → pula direto pra senha; botão voltar em cada etapa; "/" com sessão pula
 * pro dashboard certo.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

async function backendJson(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

test("`/` sem sessão redireciona para /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar ou criar conta" })).toBeVisible();
});

test("e-mail novo → escolhe Treinar (ALUNO), completa cadastro e chega no dashboard certo", async ({
  page,
}) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_auth_novo_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  await page.goto("/login");
  await page.locator("#email").fill(alunoEmail);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Esse e-mail ainda não tem conta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vamos criar sua conta" })).toBeVisible();

  // Chips na ordem certa (Treinar antes de Personal) e Nutricionista ausente.
  const chips = page.locator("button", { hasText: /^(Treinar|Personal)$/ });
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).toHaveText("Treinar");
  await expect(chips.nth(1)).toHaveText("Personal");
  await expect(page.getByRole("button", { name: "Nutricionista" })).toHaveCount(0);

  await page.getByRole("button", { name: "Treinar", exact: true }).click();
  await expect(
    page.getByText("Monte seus próprios treinos ou acompanhe o que seu Personal te passou.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  await expect(page.getByText("Treinar", { exact: true })).toBeVisible();

  await page.locator("#name").fill("Fulano de Tal");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const login = await backendJson("/api/auth/login", { email: alunoEmail, password });
  expect(login.user.role).toBe("ALUNO");

  // Sessão já existe agora — "/" pula a seleção e vai direto pro dashboard.
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("e-mail novo → escolhe Personal, completa cadastro e chega no dashboard certo", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_auth_novo_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  await page.goto("/login");
  await page.locator("#email").fill(personalEmail);
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await expect(
    page.getByText("Entre para gerenciar seus alunos, prescrever e acompanhar treinos.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

  await page.locator("#name").fill("Fulana Personal");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  const login = await backendJson("/api/auth/login", { email: personalEmail, password });
  expect(login.user.role).toBe("PERSONAL");
});

test("e-mail já cadastrado pula direto para a etapa de senha (login)", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e_auth_existente_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email, password, role: "ALUNO" });

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Bem-vindo de volta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // Nenhuma seleção de papel nesta etapa — é login direto.
  await expect(page.getByRole("button", { name: "Treinar" })).toHaveCount(0);

  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("botão voltar troca de e-mail a partir da etapa de senha ou de escolha de papel", async ({
  page,
}) => {
  const stamp = Date.now();
  const existingEmail = `e2e_auth_voltar_existente_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email: existingEmail, password, role: "ALUNO" });

  // Volta a partir do login (e-mail existente).
  await page.goto("/login");
  await page.locator("#email").fill(existingEmail);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

  await page.getByText("trocar e-mail").click();
  await expect(page.getByRole("heading", { name: "Entrar ou criar conta" })).toBeVisible();
  await expect(page.locator("#email")).toHaveValue(existingEmail);

  // Volta a partir da escolha de papel (e-mail novo).
  const novoEmail = `e2e_auth_voltar_novo_${stamp}@thunderafit.test`;
  await page.locator("#email").fill(novoEmail);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Vamos criar sua conta" })).toBeVisible();

  await page.getByText("trocar e-mail").click();
  await expect(page.getByRole("heading", { name: "Entrar ou criar conta" })).toBeVisible();

  // Volta da etapa de detalhes pra escolha de papel, mantendo o e-mail.
  await page.locator("#email").fill(novoEmail);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

  await page.getByText("trocar perfil").click();
  await expect(page.getByRole("heading", { name: "Vamos criar sua conta" })).toBeVisible();
});

test("`/` com sessão já existente redireciona direto para o dashboard certo (Personal)", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_auth_sessao_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
});
