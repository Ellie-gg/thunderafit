import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Billing 3 degraus (evolução do FREE/PAGO de 2 estados): Free (3 alunos,
 * como hoje), Base (20 alunos, ganha acesso ao diretório de descoberta) e
 * Plus (ilimitado, destaque/prioridade no diretório). O checkout de verdade
 * (Stripe) não é exercido aqui — só o gate de disponibilidade no diretório,
 * que não depende de nenhuma chave do Stripe. O upgrade de degrau em si é
 * simulado via `db:grant-plan` (mesmo padrão de bootstrap fora de HTTP já
 * usado por `db:seed:admin`), já que não há caminho de self-service sem
 * pagamento real.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";
const ROOT_DIR = path.resolve(__dirname, "..", "..");

async function backendJson(p: string, body: unknown, token?: string) {
  const res = await fetch(`${BACKEND_URL}${p}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function grantPlan(email: string, tier: "BASE" | "PLUS") {
  execFileSync("npm", ["run", "db:grant-plan"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, GRANT_EMAIL: email, GRANT_TIER: tier },
  });
}

test("Personal FREE não consegue ativar disponibilidade no diretório e vê o convite de upgrade", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_tier_free_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto("/personal/perfil");
  await expect(page.getByRole("heading", { name: "Perfil público" })).toBeVisible();

  const toggle = page.getByRole("switch", { name: "Disponível para novos alunos" });
  await expect(toggle).toBeDisabled();
  await expect(page.getByText("Disponibilidade no diretório é um recurso dos planos Base e Plus.")).toBeVisible();
  await page.getByRole("link", { name: "Fazer upgrade" }).click();
  await expect(page).toHaveURL(/\/personal\/upgrade$/);
});

test("Personal Base ativa disponibilidade; Personal Plus aparece com destaque e antes no diretório", async ({
  page,
}) => {
  const stamp = Date.now();
  const baseEmail = `e2e_tier_base_${stamp}@thunderafit.test`;
  const plusEmail = `e2e_tier_plus_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_tier_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const cidade = `TierCidade${stamp}`;

  await backendJson("/api/auth/register", { email: baseEmail, password, role: "PERSONAL" });
  await backendJson("/api/auth/register", { email: plusEmail, password, role: "PERSONAL" });
  await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  grantPlan(baseEmail, "BASE");
  grantPlan(plusEmail, "PLUS");

  const baseLogin = await backendJson("/api/auth/login", { email: baseEmail, password });
  const plusLogin = await backendJson("/api/auth/login", { email: plusEmail, password });
  await fetch(`${BACKEND_URL}/api/professionals/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${baseLogin.accessToken}` },
    body: JSON.stringify({ availableForNewStudents: true, location: cidade }),
  });
  await fetch(`${BACKEND_URL}/api/professionals/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${plusLogin.accessToken}` },
    body: JSON.stringify({ availableForNewStudents: true, location: cidade }),
  });

  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/profissionais");
  await page.locator("#location").fill(cidade);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText("★ Plus")).toBeVisible();

  // Plus aparece ANTES de Base na lista (destaque/prioridade).
  const cardTexts = await page.locator("div.rounded-xl", { hasText: "📍" }).allTextContents();
  const plusIndex = cardTexts.findIndex((t) => t.includes(plusEmail.split("@")[0]));
  const baseIndex = cardTexts.findIndex((t) => t.includes(baseEmail.split("@")[0]));
  expect(plusIndex).toBeGreaterThanOrEqual(0);
  expect(baseIndex).toBeGreaterThanOrEqual(0);
  expect(plusIndex).toBeLessThan(baseIndex);
});
