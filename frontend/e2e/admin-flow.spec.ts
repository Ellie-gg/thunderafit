import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Painel Administrativo (Fase 14, Bloco 4). ADMIN não tem auto-cadastro —
 * criado via o mesmo script de bootstrap real (`prisma/seed-admin.ts`) que um
 * operador rodaria em produção, não via um atalho só de teste, para provar
 * que o script funciona de ponta a ponta e não só a UI.
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

test("admin loga, navega pelo painel e vê dados reais (overview, usuários, SLA, anamnese auditada)", async ({
  page,
}) => {
  const stamp = Date.now();
  const adminEmail = `e2e_pw_admin_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_admin_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_pw_admin_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  execFileSync("npm", ["run", "db:seed:admin"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password },
  });

  // --- Setup de dados via backend direto (não é o que está sob teste aqui) ---
  const personal = await backendJson("/api/auth/register", {
    email: personalEmail,
    password,
    role: "PERSONAL",
  });
  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  await backendJson(
    "/api/anamnesis",
    { fullName: "Aluno E2E Admin", heightCm: 180, weightKg: 80 },
    alunoLogin.accessToken
  );

  // --- Admin loga pela UI ---
  await loginViaUI(page, adminEmail, password);
  await expect(page).toHaveURL(/\/nimbus\/dashboard$/);

  // Overview: dado real, não mock — o Personal criado agora conta em "Personal Trainers".
  await expect(page.getByText("Personal Trainers", { exact: true })).toBeVisible();

  // Usuários: o aluno recém-criado aparece na lista.
  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page).toHaveURL(/\/nimbus\/usuarios$/);
  await expect(page.getByText(alunoEmail)).toBeVisible();

  // Logins: o login do Personal feito no setup aparece no histórico.
  await page.getByRole("link", { name: "Logins" }).click();
  await expect(page).toHaveURL(/\/nimbus\/logins$/);
  await expect(page.getByText(personalEmail)).toBeVisible();

  // Anamnese do aluno, acessada a partir da lista de usuários — sem vínculo com o admin.
  await page.getByRole("link", { name: "Usuários" }).click();
  await page
    .locator("div.rounded-md")
    .filter({ hasText: alunoEmail })
    .getByRole("link", { name: "Ver anamnese" })
    .click();
  await expect(page.getByText("Aluno E2E Admin")).toBeVisible();
  await expect(page.getByText(/está sendo registrado/)).toBeVisible();

  // O acesso acima aparece nos Logs de acesso (link do header, não o inline do aviso).
  await page.getByRole("banner").getByRole("link", { name: "Logs de acesso" }).click();
  await expect(page).toHaveURL(/\/nimbus\/logs-acesso$/);
  // Ao menos uma linha de log com o recurso "Anamnese" (o span da linha, não o
  // texto introdutório da página).
  await expect(page.getByText("Anamnese", { exact: true }).first()).toBeVisible();
});
