import { test, expect } from "@playwright/test";

/**
 * Fluxo de Evolução (Fase 8): login → /evolucao → gráfico de carga máxima e
 * frequência renderizando com dados reais (não mockados), a partir de
 * SetLogs criados de verdade via chamadas HTTP diretas ao backend antes do
 * teste — mesmo padrão de setup do critical-flow.spec.ts (Fase 7).
 *
 * Pré-requisitos: backend + Postgres rodando (ver frontend/README.md).
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

test("login → /evolucao → gráfico de carga e frequência com dados reais", async ({ page }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_evo_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_evo_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  // --- Setup de dados via backend direto ---
  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const personalToken = personalLogin.accessToken;

  await fetch(`${BACKEND_URL}/api/relations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalToken}` },
    body: JSON.stringify({ alunoId: aluno.user.id }),
  });

  const workoutRes = await fetch(`${BACKEND_URL}/api/workouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalToken}` },
    body: JSON.stringify({ alunoId: aluno.user.id, name: "Treino Evolução E2E", letter: "A" }),
  });
  const workout = await workoutRes.json();

  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  });
  const exercisesData = await exercisesRes.json();
  const exercise = exercisesData.exercises[0];

  const weRes = await fetch(`${BACKEND_URL}/api/workouts/${workout.workout.id}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalToken}` },
    body: JSON.stringify({ exerciseId: exercise.id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 }),
  });
  const workoutExercise = (await weRes.json()).workoutExercise;

  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  const alunoToken = alunoLogin.accessToken;

  for (const weightKg of [55, 60]) {
    await fetch(`${BACKEND_URL}/api/workouts/${workout.workout.id}/exercises/${workoutExercise.id}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${alunoToken}` },
      body: JSON.stringify({ setNumber: weightKg === 55 ? 1 : 2, repsDone: 10, weightKg }),
    });
  }

  // --- 1. Login como aluno pela UI ---
  await page.goto("/login");
  await page.locator("#email").fill(alunoEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // --- 2. Navegar para /evolucao via o link do AppHeader ---
  // Fase 12 (Item 4): o dashboard também ganhou um teaser com link para
  // /evolucao, então "Evolução" sozinho agora casa com 2 elementos — usar o
  // link exato do header em vez do teaser.
  await page.getByRole("link", { name: "Evolução", exact: true }).click();
  await expect(page).toHaveURL(/\/evolucao$/);

  // --- 3. Selecionar o exercício e ver o gráfico de carga renderizado ---
  const select = page.locator("select");
  await expect(select).toBeVisible();
  await expect(select.locator("option", { hasText: exercise.name })).toHaveCount(1);

  // O gráfico (SVG do Recharts) deve estar presente com os dados reais
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible();

  // A tabela alternativa (acessibilidade) deve conter o pico real de 60kg
  await page.getByText("Ver como tabela").click();
  await expect(page.getByText("60kg")).toBeVisible();

  // --- 4. Seção de frequência com pelo menos 1 treino no período ---
  await expect(page.getByText(/treino\(s\) no período/)).toBeVisible();
  await expect(page.getByText("1 treino(s) no período")).toBeVisible();
});
