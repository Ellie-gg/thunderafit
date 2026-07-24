import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * "Montagem Inteligente" (gerador de treino determinístico, sem IA externa) +
 * CTA de destaque no dashboard do Personal. Gera o PROGRAMA inteiro (não uma
 * sessão avulsa): setup (nome + esquema + objetivo) → wizard por sessão
 * (grupos musculares → gerar/revisar → "Próximo treino →" ou "Salvar
 * programa de treinamento"). Ponta a ponta pela UI real, backend + Postgres
 * reais.
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

test("Personal gera um PROGRAMA com 2 sessões (A e B) pela Montagem Inteligente e para antes da E", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_gen_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Programa Gerado E2E ${stamp}`;

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // O novo CTA principal do dashboard — resolve a queixa de descoberta de templates.
  const generateButton = page.getByRole("button", { name: "⚡ Gerar Treino Rápido" });
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  // --- Setup: nome + esquema (Letras, padrão) + objetivo ---
  await expect(page.getByRole("heading", { name: "⚡ Gerar Treino Rápido" })).toBeVisible();
  await page.locator("#generate-program-name").fill(programName);
  await page.locator("#generate-goal").selectOption("forca");
  await page.getByRole("button", { name: "Avançar" }).click();

  // --- Sessão A: Peito (principal, 3) + Costas (secundário, 2) = 5 ---
  await expect(page.getByRole("heading", { name: "Sessão A" })).toBeVisible();
  await page.getByRole("button", { name: "Peito", exact: true }).click();
  await page.getByRole("button", { name: "Costas", exact: true }).click();
  await page.getByRole("button", { name: "Gerar sugestão" }).click();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(5);
  await page.getByRole("button", { name: "Remover" }).first().click();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(4);
  await page.getByRole("button", { name: "Próximo treino →" }).click();

  // --- Sessão B: Quadríceps (principal, 3) ---
  await expect(page.getByRole("heading", { name: "Sessão B" })).toBeVisible();
  await page.getByRole("button", { name: "Quadríceps", exact: true }).click();
  await page.getByRole("button", { name: "Gerar sugestão" }).click();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(3);

  // Para aqui de propósito (não vai até E) — "Salvar" precisa funcionar mesmo assim.
  await page.getByRole("button", { name: "Salvar programa de treinamento" }).click();

  await expect(page).toHaveURL(/\/personal\/programas\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name: programName })).toBeVisible();
  await expect(page.getByText("2/5 sessão(ões)")).toBeVisible();
  await expect(page.getByText("4 exercício(s)")).toBeVisible();
  await expect(page.getByText("3 exercício(s)")).toBeVisible();
});

test("Pular uma sessão gera 0 exercícios nela, sem travar o fluxo", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_gen_skip_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Programa Pulado E2E ${stamp}`;

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  await page.getByRole("button", { name: "⚡ Gerar Treino Rápido" }).click();
  await page.locator("#generate-program-name").fill(programName);
  await page.getByRole("button", { name: "Avançar" }).click();

  await expect(page.getByRole("heading", { name: "Sessão A" })).toBeVisible();
  await page.getByRole("button", { name: "Pular esta sessão" }).click();
  await expect(page.getByText("Sessão sem exercícios (pulada).")).toBeVisible();
  await page.getByRole("button", { name: "Salvar programa de treinamento" }).click();

  await expect(page).toHaveURL(/\/personal\/programas\/[a-f0-9-]+$/);
  await expect(page.getByText("1/5 sessão(ões)")).toBeVisible();
  await expect(page.getByText("0 exercício(s)")).toBeVisible();
});

test("Fluxo manual continua disponível: link 'ou monte um programa do zero' leva pra /personal/programas", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_gen_manual_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.getByRole("link", { name: "ou monte um programa do zero →" }).click();
  await expect(page).toHaveURL(/\/personal\/programas$/);
});
