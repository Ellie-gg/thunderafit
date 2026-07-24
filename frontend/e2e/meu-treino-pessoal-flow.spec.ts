import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 34.5 — "Meu treino pessoal": admin cura um template (origin: SELF,
 * via API — a UI de curadoria em si já tem cobertura própria de backend em
 * admin-self-templates.test.ts), o aluno vê o template em
 * /meu-treino-pessoal, aplica, executa e conclui — e só nesse caso (origin:
 * SELF) vê o CTA de convidar um Personal no card de resumo pós-treino.
 * ADMIN não tem auto-cadastro — mesmo padrão de bootstrap real usado em
 * admin-flow.spec.ts (`prisma/seed-admin.ts` via npm script, não um atalho
 * só de teste).
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";
const ROOT_DIR = path.resolve(__dirname, "..", "..");

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

test("aluno aplica um treino pessoal curado pelo admin, executa e vê o CTA de convidar Personal", async ({
  page,
}) => {
  const stamp = Date.now();
  const adminEmail = `e2e_meutreino_admin_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_meutreino_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const templateName = `Template Pessoal E2E ${stamp}`;

  execFileSync("npm", ["run", "db:seed:admin"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password },
  });
  const adminLogin = await backendJson("/api/auth/login", { email: adminEmail, password });
  const adminToken = adminLogin.accessToken;

  await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });

  // --- Admin cura o template pela API (setup, não é o que está sob teste). ---
  const createRes = await fetch(`${BACKEND_URL}/api/admin/self-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: templateName }),
  });
  const template = (await createRes.json()).program;

  await fetch(`${BACKEND_URL}/api/admin/self-templates/${template.id}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ letter: "A" }),
  });
  const detail = await fetch(`${BACKEND_URL}/api/admin/self-templates/${template.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then((r) => r.json());
  const sessionId = detail.program.workouts[0].id;

  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const exercisesData = await exercisesRes.json();

  await fetch(`${BACKEND_URL}/api/admin/self-templates/${template.id}/sessions/${sessionId}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      exerciseId: exercisesData.exercises[0].id,
      sets: 1,
      repsRange: "8-12",
      restSeconds: 60,
      order: 1,
    }),
  });

  // --- Aluno: vê o template, aplica, executa e conclui ---
  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/meu-treino-pessoal");
  await expect(page.getByText(templateName)).toBeVisible();

  const card = page.locator("div.rounded-xl", { hasText: templateName });
  await card.getByRole("button", { name: "Aplicar este treino" }).click();

  await expect(page).toHaveURL(/\/programas\/[a-f0-9-]+$/);

  await page.getByRole("link", { name: /Abrir/ }).first().click();
  const repsInput = page.locator('input[type="number"]').nth(0);
  const weightInput = page.locator('input[type="number"]').nth(1);
  await repsInput.fill("10");
  await weightInput.fill("20");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("1/1 séries")).toBeVisible();

  await page.getByRole("button", { name: "Concluir sessão" }).click();
  await expect(page.getByText(/mandou bem no treino/)).toBeVisible();

  // CTA de upsell só aparece pra treinos origin: SELF.
  await expect(page.getByRole("link", { name: "Convide um Personal" })).toBeVisible();
});
