import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 65:
 * 1) Personal exclui um exercício já prescrito (antes só dava pra adicionar
 *    ou reordenar) — com confirmação inline, some da lista.
 * 2) "Ver como o aluno vê" abre um preview somente-leitura, no layout visual
 *    do aluno, refletindo a exclusão acima.
 * 3) Dashboard do Personal no plano Plus (ilimitado) esconde a contagem/
 *    barra de alunos — bug de perf corrigido (a barra tentava renderizar
 *    1 segmento por unidade do limite, 1_000_000 no Plus).
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

async function backendJson(path: string, body: unknown, token?: string, method = "POST") {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return res.json();
}

test("Personal exclui um exercício prescrito e confere no preview 'ver como o aluno vê'", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_exccrud_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_exccrud_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Programa Exclui Exercicio ${stamp}`;

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  const tpl = await backendJson("/api/workout-programs", { name: programName }, personalLogin.accessToken);
  const session = await backendJson(
    `/api/workout-programs/${tpl.program.id}/sessions`,
    { letter: "A" },
    personalLogin.accessToken
  );
  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalLogin.accessToken}` },
  }).then((r) => r.json());
  const [exerciseA, exerciseB] = exercisesRes.exercises;

  await backendJson(
    `/api/workouts/${session.session.id}/exercises`,
    { exerciseId: exerciseA.id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 },
    personalLogin.accessToken
  );
  await backendJson(
    `/api/workouts/${session.session.id}/exercises`,
    { exerciseId: exerciseB.id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 2 },
    personalLogin.accessToken
  );

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto(`/personal/programas/${tpl.program.id}/sessoes/${session.session.id}`);

  // Escopado à lista de exercícios PRESCRITOS (<ul><li>) — a mesma tela
  // também lista o catálogo inteiro (232 exercícios) no formulário de
  // adicionar, incluindo por acaso outros itens com nome parecido.
  const prescribedList = page.locator("ul > li");
  await expect(prescribedList.filter({ hasText: exerciseA.name })).toBeVisible({ timeout: 15000 });
  await expect(prescribedList.filter({ hasText: exerciseB.name })).toBeVisible();

  // --- Exclui o primeiro exercício, com confirmação inline ---
  await page.getByRole("button", { name: "Remover exercício" }).first().click();
  await expect(page.getByText("Remover este exercício do treino?")).toBeVisible();
  await page.getByRole("button", { name: "Sim, remover" }).click();
  await expect(prescribedList.filter({ hasText: exerciseA.name })).toHaveCount(0, { timeout: 15000 });
  await expect(prescribedList.filter({ hasText: exerciseB.name })).toBeVisible();

  // --- "Ver como o aluno vê": preview somente-leitura reflete a exclusão ---
  await page.getByRole("link", { name: "Ver como o aluno vê →" }).click();
  await expect(page).toHaveURL(/\/visualizar$/);
  await expect(page.getByText("Pré-visualização (somente leitura)")).toBeVisible();
  await expect(page.getByText(exerciseB.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(exerciseA.name, { exact: true })).toHaveCount(0);
  // Sem nada interativo de execução (checkbox/registrar série) — só preview.
  await expect(page.getByRole("button", { name: /Registrar/i })).toHaveCount(0);
});

test("Plano Plus: dashboard do Personal esconde a contagem/barra de alunos (bug de perf corrigido)", async ({
  page,
}) => {
  const stamp = Date.now();
  const adminEmail = `e2e_plusdash_admin_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_plusdash_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  const personalReg = await backendJson("/api/auth/register", {
    email: personalEmail,
    password,
    role: "PERSONAL",
  });

  const ROOT_DIR = path.resolve(__dirname, "..", "..");
  execFileSync("npm", ["run", "db:seed:admin"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password },
  });
  const adminLogin = await backendJson("/api/auth/login", { email: adminEmail, password });
  await fetch(`${BACKEND_URL}/api/admin/users/${personalReg.user.id}/premium`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminLogin.accessToken}`,
    },
    body: JSON.stringify({ active: true }),
  });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  await expect(page.getByText("Alunos ilimitados", { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/^\d+\/\d+$/)).toHaveCount(0);
});
