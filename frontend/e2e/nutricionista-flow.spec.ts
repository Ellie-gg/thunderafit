import { test, expect } from "@playwright/test";

/**
 * Fluxo do Nutricionista (Fase 11, Bloco 3) — o equivalente ao painel do
 * Personal (Fase 6), mas para o segundo tipo de profissional: cadastro,
 * vínculo de aluno e criação de um plano de dieta com refeições e alimentos
 * reais, tudo pela UI, contra backend + Postgres reais.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

async function backendJson(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  return res.json();
}

test("Nutricionista se cadastra, vincula aluno e cria plano de dieta com 2 refeições", async ({ page }) => {
  const stamp = Date.now();
  const nutriEmail = `e2e_pw_nutri_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_pw_nutri_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  // Aluno já existe previamente (o Nutricionista descobre pelo e-mail, igual ao Personal na Fase 6)
  await backendJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: alunoEmail, password, role: "ALUNO" }),
  });

  // --- 1. Cadastro do Nutricionista pela UI ---
  await page.goto("/register");
  await page.locator("#email").fill(nutriEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Nutricionista" }).click();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/nutricionista\/dashboard$/);
  await expect(page.getByText("0/3")).toBeVisible();

  // --- 2. Vincula o aluno pela UI ---
  await page.getByRole("link", { name: "Vincular novo aluno" }).click();
  await expect(page).toHaveURL(/\/nutricionista\/alunos\/novo$/);
  await page.locator("#email").fill(alunoEmail);
  await page.getByRole("button", { name: "Vincular aluno" }).click();
  await expect(page).toHaveURL(/\/nutricionista\/dashboard$/);
  await expect(page.getByText("1/3")).toBeVisible();
  await expect(page.getByText(alunoEmail)).toBeVisible();

  // --- 3. Cria o plano de dieta pela UI ---
  await page.getByRole("link", { name: "Criar novo plano de dieta" }).click();
  await expect(page).toHaveURL(/\/nutricionista\/planos\/novo$/);
  await page.locator("#aluno").selectOption({ label: alunoEmail });
  await page.locator("#name").fill("Plano E2E Fase 11");
  await page.getByRole("button", { name: "Criar plano" }).click();
  await expect(page).toHaveURL(/\/nutricionista\/planos\/[a-f0-9-]+$/);
  await expect(page.getByText("Plano E2E Fase 11")).toBeVisible();

  // --- 4. Adiciona 2 refeições ---
  await page.locator("#mealName").fill("Café da manhã");
  await page.locator("#mealTime").fill("07:00");
  await page.getByRole("button", { name: "Adicionar refeição" }).click();
  await expect(page.getByRole("heading", { name: /Adicionar alimento — Café da manhã/ })).toBeVisible();

  await page.locator("#mealName").fill("Almoço");
  await page.locator("#mealTime").fill("12:00");
  await page.getByRole("button", { name: "Adicionar refeição" }).click();
  await expect(page.getByRole("heading", { name: /Adicionar alimento — Almoço/ })).toBeVisible();

  // --- 5. Adiciona alimentos à primeira refeição criada (Café da manhã) ---
  const cafeSection = page
    .getByRole("heading", { name: /Adicionar alimento — Café da manhã/ })
    .locator("..");
  await cafeSection
    .locator("select")
    .selectOption({ label: "Aveia em Flocos (30g)" });
  await cafeSection.getByRole("button", { name: "Adicionar alimento" }).click();
  await expect(page.getByText(/Aveia em Flocos/).first()).toBeVisible();

  // --- 6. Confirma persistência real via backend direto (não é só estado local) ---
  const planIdMatch = page.url().match(/\/planos\/([a-f0-9-]+)$/);
  const planId = planIdMatch ? planIdMatch[1] : "";
  const loginNutri = await backendJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: nutriEmail, password }),
  });
  const planFromBackend = await fetch(`${BACKEND_URL}/api/diet-plans/${planId}`, {
    headers: { Authorization: `Bearer ${loginNutri.accessToken}` },
  }).then((r) => r.json());

  type MealFromBackend = { name: string; foods: unknown[] };
  expect(planFromBackend.plan.meals).toHaveLength(2);
  expect(
    planFromBackend.plan.meals.some((m: MealFromBackend) => m.name === "Café da manhã")
  ).toBe(true);
  expect(
    planFromBackend.plan.meals.find((m: MealFromBackend) => m.name === "Café da manhã").foods
      .length
  ).toBeGreaterThanOrEqual(1);
});
