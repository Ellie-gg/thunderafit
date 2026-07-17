import { test, expect } from "@playwright/test";

/**
 * Fase 21 — descoberta de profissionais, ponta a ponta pela UI:
 * Personal ativa disponibilidade + localização (tela de perfil), aluno busca
 * por localização e encontra, solicita vínculo, Personal recebe a solicitação
 * e aceita, aluno vê o status "Aceita". Backend + Postgres reais.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

async function backendJson(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("Personal fica disponível, aluno busca e solicita, Personal aceita, aluno vê aceito", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_disc_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_disc_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const cidade = `CidadeTeste${stamp}`; // localização única p/ isolar a busca

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });

  // --- 1. Personal ativa disponibilidade + localização pela UI ---
  await login(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto("/personal/perfil");
  await expect(page.getByRole("heading", { name: "Perfil público" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("switch", { name: "Disponível para novos alunos" }).click();
  await page.locator("#location").fill(cidade);
  await page.locator("#bio").fill("Treino de teste E2E");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Perfil salvo.")).toBeVisible();

  // --- 2. Aluno busca pela localização e encontra, solicita ---
  await login(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/profissionais");
  await expect(page.getByRole("heading", { name: "Encontrar Personal" })).toBeVisible({ timeout: 30000 });
  await page.locator("#location").fill(cidade);
  await page.getByRole("button", { name: "Buscar" }).click();

  const proCard = page.locator("div", { hasText: personalEmail.split("@")[0] });
  await expect(page.getByText("Treino de teste E2E")).toBeVisible();
  await page.getByRole("button", { name: "Solicitar vínculo" }).first().click();
  // Após solicitar, o resultado mostra o status Pendente.
  await expect(page.getByText("Pendente").first()).toBeVisible();

  // --- 3. Personal recebe e aceita pela UI ---
  await login(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto("/personal/solicitacoes");
  await expect(page.getByRole("heading", { name: "Solicitações de vínculo" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(alunoEmail)).toBeVisible();
  await page.getByRole("button", { name: "Aceitar" }).first().click();
  // Sai dos pendentes → aparece no histórico como Aceita.
  await expect(page.getByText("Aceita").first()).toBeVisible();

  // --- 4. Vínculo real criado: o aluno aparece nos alunos do Personal ---
  await page.goto("/personal/dashboard");
  await expect(page.getByText(alunoEmail)).toBeVisible({ timeout: 30000 });

  // --- 5. Aluno vê a solicitação como Aceita ---
  await login(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/profissionais");
  await expect(page.getByRole("heading", { name: "Encontrar Personal" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Aceita").first()).toBeVisible();
});
