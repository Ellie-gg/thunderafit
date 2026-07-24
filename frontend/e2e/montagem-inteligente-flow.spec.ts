import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * "Montagem Inteligente" (gerador de treino determinístico, sem IA externa) +
 * CTA de destaque no dashboard do Personal. Ponta a ponta pela UI: Personal
 * loga, clica "⚡ Gerar Treino Rápido" (agora o CTA principal do dashboard —
 * antes só um botão secundário "Criar novo programa", pouco descoberto),
 * escolhe grupos musculares + objetivo, revisa o rascunho (removendo uma
 * linha), confirma, e cai na tela do programa recém-criado com a sessão e
 * os exercícios de verdade.
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

test("Personal gera um treino pela Montagem Inteligente, revisa, remove uma linha e cria o programa", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_gen_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const sessionName = `Sessão Gerada E2E ${stamp}`;

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // O novo CTA principal do dashboard — resolve a queixa de descoberta de templates.
  const generateButton = page.getByRole("button", { name: "⚡ Gerar Treino Rápido" });
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  await expect(page.getByRole("heading", { name: "⚡ Gerar Treino Rápido" })).toBeVisible();
  await page.locator("#generate-name").fill(sessionName);
  // Peito primeiro (principal, 3 exercícios) + Costas depois (secundário, 2).
  await page.getByRole("button", { name: "Peito", exact: true }).click();
  await page.getByRole("button", { name: "Costas", exact: true }).click();
  await page.locator("#generate-goal").selectOption("forca");
  await page.getByRole("button", { name: "Gerar sugestão" }).click();

  // Revisão: 5 linhas (3 + 2), cada uma com botão "Remover".
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(5);
  await page.getByRole("button", { name: "Remover" }).first().click();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(4);

  await page.getByRole("button", { name: "Criar treino" }).click();

  await expect(page).toHaveURL(/\/personal\/programas\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name: sessionName })).toBeVisible();
  await expect(page.getByText(`${sessionName}`).first()).toBeVisible();
  await expect(page.getByText("4 exercício(s)")).toBeVisible();
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
