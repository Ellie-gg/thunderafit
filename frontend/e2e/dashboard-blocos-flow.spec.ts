import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 36 — dashboard do aluno com dois blocos claros ("Prescrito pelo seu
 * Personal" e "Meus treinos", este último incluindo os templates da Fase
 * 34.5) e card de convite copiável quando o aluno não tem nenhum Personal
 * vinculado. Antes desta fase, um único card de "próxima sessão" misturava
 * os dois origins (PERSONAL e SELF) sem distinção, e "ter Personal" era
 * (erradamente, pós Fase 34.5) inferido de "ter algum programa".
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

test("aluno sem Personal e sem treino aplicado vê os blocos vazios com convite copiável", async ({
  page,
}) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_blocos_vazio_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });

  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(
    page.getByText("Você ainda não tem nenhum treino ou plano de dieta")
  ).toBeVisible();

  await expect(page.getByText("Prescrito pelo seu Personal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ainda sem um Personal?" })).toBeVisible();
  await page.getByRole("button", { name: "Copiar convite para compartilhar" }).click();
  await expect(page.getByRole("button", { name: "Convite copiado!" })).toBeVisible();

  await expect(page.getByText("Meus treinos", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver treinos disponíveis" })).toBeVisible();
});

test("aluno com Personal e treino pessoal aplicado vê os dois blocos preenchidos, sem o convite", async ({
  page,
}) => {
  const stamp = Date.now();
  const adminEmail = `e2e_blocos_admin_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_blocos_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_blocos_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const templateName = `Template Bloco E2E ${stamp}`;

  // --- Setup via backend direto (não é o que está sob teste aqui) ---
  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });

  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  const workout = await backendJson(
    "/api/workouts",
    { alunoId: aluno.user.id, name: "Treino Bloco Personal", letter: "A" },
    personalLogin.accessToken
  );
  const exercises = await backendJson("/api/exercises", null, personalLogin.accessToken, "GET");
  await backendJson(
    `/api/workouts/${workout.workout.id}/exercises`,
    { exerciseId: exercises.exercises[0].id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 },
    personalLogin.accessToken
  );

  execFileSync("npm", ["run", "db:seed:admin"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password },
  });
  const adminLogin = await backendJson("/api/auth/login", { email: adminEmail, password });

  const template = (
    await backendJson("/api/admin/self-templates", { name: templateName }, adminLogin.accessToken)
  ).program;
  await backendJson(
    `/api/admin/self-templates/${template.id}/sessions`,
    { letter: "A" },
    adminLogin.accessToken
  );
  const detail = await backendJson(
    `/api/admin/self-templates/${template.id}`,
    null,
    adminLogin.accessToken,
    "GET"
  );
  await backendJson(
    `/api/admin/self-templates/${template.id}/sessions/${detail.program.workouts[0].id}/exercises`,
    { exerciseId: exercises.exercises[0].id, sets: 1, repsRange: "8-12", restSeconds: 60, order: 1 },
    adminLogin.accessToken
  );
  await backendJson(
    `/api/workout-programs/${template.id}/apply-self-template`,
    {},
    alunoLogin.accessToken
  );

  // --- Aluno vê os dois blocos preenchidos ---
  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByRole("heading", { name: "Ainda sem um Personal?" })).toHaveCount(0);
  await expect(page.getByText("Prescrito pelo seu Personal")).toBeVisible();
  await expect(page.getByText("Meus treinos", { exact: true })).toBeVisible();
  await expect(page.getByText("Treino Bloco Personal").first()).toBeVisible();
  await expect(page.getByText(templateName).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Começar treino" })).toHaveCount(2);
});
