import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 63 — filtro rápido por chip (Todos/Feminino/Hipertrofia/Definição/
 * Express) no carrossel "Treinos Premium" de /meu-treino-pessoal: hoje com
 * muitos banners, o que prejudica a navegação. Admin marca as tags de um
 * template pela UI de curadoria (`/nimbus/treinos-pessoais`); o aluno filtra
 * pela UI de `/meu-treino-pessoal`.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";
const ROOT_DIR = path.resolve(__dirname, "..", "..");

async function backendJson(p: string, body: unknown, token?: string, method = "POST") {
  const res = await fetch(`${BACKEND_URL}${p}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return res.json();
}

test("Admin marca tags num template Premium pela UI; aluno filtra pelo chip em Treinos Premium", async ({
  browser,
}) => {
  const stamp = Date.now();
  const adminEmail = `e2e_tagfiltro_admin_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_tagfiltro_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const templateName = `Treino Tags E2E ${stamp}`;

  execFileSync("npm", ["run", "db:seed:admin"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password },
  });
  await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });

  // --- Admin cria um template Premium e marca 2 tags pela UI ---
  const adminPage = await browser.newPage();
  await loginViaUI(adminPage, adminEmail, password);
  await expect(adminPage).toHaveURL(/\/nimbus\/dashboard$/);
  await adminPage.goto("/nimbus/treinos-pessoais");

  await adminPage.locator("#name").fill(templateName);
  await adminPage.locator("#category").selectOption("PREMIUM");
  await adminPage.getByRole("button", { name: "Feminino", exact: true }).click();
  await adminPage.getByRole("button", { name: "Hipertrofia", exact: true }).click();
  await adminPage.getByRole("button", { name: "Criar template" }).click();
  await expect(adminPage.getByText(templateName)).toBeVisible({ timeout: 15000 });
  await adminPage.close();

  // --- Aluno vê o carrossel Premium com chips e filtra ---
  const alunoPage = await browser.newPage();
  await loginViaUI(alunoPage, alunoEmail, password);
  await expect(alunoPage).toHaveURL(/\/dashboard$/);
  await alunoPage.goto("/meu-treino-pessoal");

  await expect(alunoPage.getByText(templateName)).toBeVisible({ timeout: 15000 });

  // Chip "Definição" (não marcado neste template) → some da lista.
  await alunoPage.getByRole("button", { name: "Definição", exact: true }).click();
  await expect(alunoPage.getByText(templateName)).toHaveCount(0);

  // Chip "Hipertrofia" (marcado) → volta a aparecer.
  await alunoPage.getByRole("button", { name: "Hipertrofia", exact: true }).click();
  await expect(alunoPage.getByText(templateName)).toBeVisible();

  // "Todos" → sempre visível, sem filtro.
  await alunoPage.getByRole("button", { name: "Todos", exact: true }).click();
  await expect(alunoPage.getByText(templateName)).toBeVisible();
  await alunoPage.close();
});
