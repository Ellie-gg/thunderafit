import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 25 — corrige o fluxo de criação de treino do Personal: em vez de criar
 * um Workout avulso (tela antiga /personal/treinos/novo, removida), o Personal
 * agora cria um WorkoutProgram primeiro, adiciona sessões A-E dentro dele e
 * aplica como template a um aluno vinculado — tudo pela UI real, contra
 * backend + Postgres reais.
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

test("Personal cria programa, adiciona as 5 sessões A-E, prescreve um exercício e aplica como template a um aluno", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_prog25_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_prog25_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Foco em Peito ${stamp}`;

  const aluno = await backendJson("/api/auth/register", {
    email: alunoEmail,
    password,
    role: "ALUNO",
  });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const personalToken = personalLogin.accessToken;
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalToken);

  // --- 1. Login como Personal e navega a partir do dashboard ---
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.getByRole("link", { name: "Criar novo programa" }).click();
  await expect(page).toHaveURL(/\/personal\/programas$/);

  // --- 2. Cria o programa, já escolhendo o aluno-alvo (opcional) ---
  await page.locator("#name").fill(programName);
  await page.locator("#targetAluno").selectOption({ label: alunoEmail });
  await page.getByRole("button", { name: "Criar programa" }).click();
  await expect(page).toHaveURL(/\/personal\/programas\/[a-f0-9-]+\?alunoId=/);
  await expect(page.getByRole("heading", { name: programName })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Template", { exact: true })).toBeVisible();

  // --- 3. Adiciona as 5 sessões A-E (corrige o gap da tela antiga, que só ia até D) ---
  for (const letter of ["A", "B", "C", "D", "E"]) {
    const addButton = page.getByRole("button", { name: `+ ${letter}`, exact: true });
    await addButton.click();
    await expect(addButton).toHaveCount(0);
  }
  // Depois de completar as 5, o cartão "Adicionar sessão" não aparece mais.
  await expect(page.getByText("Adicionar sessão")).toHaveCount(0);
  await expect(page.getByText("5/5 sessão(ões)")).toBeVisible();

  // --- 4. Abre a sessão A (primeira da lista, ordenada por letra) e prescreve
  // um exercício via o catálogo já existente ---
  await page.getByRole("button", { name: "Exercícios" }).first().click();
  await page.locator("#filter").fill("Supino Reto com Barra");
  await page.getByRole("option", { name: /Supino Reto com Barra/ }).click();
  await page.getByRole("button", { name: /Adicionar exercício/ }).click();
  await expect(page.getByText(/Supino Reto com Barra/).first()).toBeVisible();

  // --- 5. Aplica o programa — o select já vem pré-preenchido com o aluno-alvo ---
  const applySelect = page.locator("select");
  await expect(applySelect).toHaveValue(aluno.user.id);
  await page.getByRole("button", { name: "Aplicar programa" }).click();
  await expect(page.getByText("Programa aplicado ao aluno.")).toBeVisible();

  // --- 6. Confirma no backend: o aluno tem uma instância de 5 sessões com o nome do programa ---
  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  const alunoPrograms = await fetch(`${BACKEND_URL}/api/workout-programs`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  const applied = alunoPrograms.programs.find((p: { name: string }) => p.name === programName);
  expect(applied).toBeDefined();
  expect(applied.workouts).toHaveLength(5);
  expect(applied.workouts.map((w: { letter: string }) => w.letter).sort()).toEqual([
    "A",
    "B",
    "C",
    "D",
    "E",
  ]);

  // --- 7. Confirma que o exercício prescrito foi copiado pra dentro da instância aplicada ---
  const sessionAId = applied.workouts.find((w: { letter: string }) => w.letter === "A").id;
  const sessionADetail = await fetch(`${BACKEND_URL}/api/workouts/${sessionAId}`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  expect(sessionADetail.workout.exercises.length).toBeGreaterThanOrEqual(1);
  expect(
    sessionADetail.workout.exercises.some((e: { exercise: { name: string } }) =>
      e.exercise.name.includes("Supino Reto com Barra")
    )
  ).toBe(true);
});
