import { test, expect } from "@playwright/test";

/**
 * Tela inicial com seleção de perfil (Fase 12, Item 1) — cobre o fluxo novo
 * de ponta a ponta: a escolha de papel agora acontece em "/", não mais
 * dentro do form de /register. Também confere que "/" continua redirecionando
 * direto para o dashboard certo quando já existe sessão.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

test("`/` mostra os 3 perfis e o registro chega pré-contextualizado", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_pw_role_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ThunderaFit" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Personal Trainer/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Aluno/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Nutricionista/ })).toBeVisible();

  await page.getByRole("link", { name: /^Personal Trainer/ }).click();
  await expect(page).toHaveURL(/\/register\?role=PERSONAL$/);
  await expect(page.getByRole("heading", { name: /Personal Trainer/ })).toBeVisible();

  await page.locator("#email").fill(personalEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // Sessão já existe agora — "/" deve pular a seleção e ir direto pro dashboard.
  await page.goto("/");
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
});

test("/register sem `role` na URL volta para a seleção de perfil", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL("http://localhost:3001/");
});

test("registro real via backend confirma o role correto quando vindo do fluxo de seleção", async ({ page }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_role_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  await page.goto("/");
  await page.getByRole("link", { name: /^Aluno/ }).click();
  await expect(page).toHaveURL(/\/register\?role=ALUNO$/);
  await page.locator("#email").fill(alunoEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const login = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: alunoEmail, password }),
  }).then((r) => r.json());

  expect(login.user.role).toBe("ALUNO");
});
