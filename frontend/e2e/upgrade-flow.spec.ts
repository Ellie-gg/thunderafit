import { test, expect } from "@playwright/test";

/**
 * Fase 20 — fluxo de upgrade (billing) na UI, SEM tocar no Stripe real:
 * Personal no limite (3/3) vê o aviso "faça upgrade", navega para a tela de
 * planos e vê os dois planos (mensal R$ 9,90 / anual R$ 95,04). Também
 * confirma o gating: /personal/upgrade é só para PERSONAL.
 *
 * O clique em "Assinar" (que redireciona para o Checkout hospedado do Stripe)
 * NÃO é exercido aqui: precisa de chaves de teste do Stripe no backend, que
 * ficam a cargo do fundador (ver evidência de webhook nos testes de backend).
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

test("Personal no limite navega para os planos e vê mensal + anual", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_up_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  const personal = await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const token = (await backendJson("/api/auth/login", { email: personalEmail, password })).accessToken;
  // 3 alunos vinculados => 3/3 (limite Freemium atingido).
  for (let i = 0; i < 3; i++) {
    const aluno = await backendJson("/api/auth/register", { email: `e2e_up_aluno${i}_${stamp}@thunderafit.test`, password, role: "ALUNO" });
    await backendJson("/api/relations", { alunoId: aluno.user.id }, token);
  }

  await page.goto("/login");
  await page.locator("#email").fill(personalEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // Aviso de limite atingido, linkando para o upgrade.
  const upgradeLink = page.getByRole("link", { name: /Faça upgrade do plano/ });
  await expect(upgradeLink).toBeVisible({ timeout: 30000 });
  await upgradeLink.click();

  await expect(page).toHaveURL(/\/personal\/upgrade$/);
  await expect(page.getByRole("heading", { name: "Fazer upgrade" })).toBeVisible();
  // Os dois planos com os preços corretos.
  await expect(page.getByText("R$ 9,90")).toBeVisible();
  await expect(page.getByText("R$ 95,04")).toBeVisible();
  await expect(page.getByRole("button", { name: "Assinar" }).first()).toBeVisible();
});

test("ALUNO não acessa /personal/upgrade (gating)", async ({ page }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_up_gate_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });

  await page.goto("/login");
  await page.locator("#email").fill(alunoEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Tentar acessar direto a tela de upgrade do Personal → AuthGuard redireciona
  // o aluno para o próprio dashboard.
  await page.goto("/personal/upgrade");
  await expect(page).toHaveURL(/\/dashboard$/);
});
