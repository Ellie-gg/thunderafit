import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fluxo crítico de ponta a ponta: login → dashboard → treino → registro de
 * série — o mesmo fluxo que os scripts Puppeteer ad-hoc das Fases 5/5.5/6
 * validaram manualmente, agora permanente no repositório.
 *
 * Requer o backend + Postgres rodando de verdade (ex: via `../dev.sh` ou
 * `../dev.ps1` na raiz do projeto) e o frontend em `npm run dev` (porta
 * 3001). Ver frontend/README.md para instruções completas.
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

test("login → dashboard → treino → registrar série", async ({ page }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  // --- Setup de dados via backend direto (não é o que está sob teste aqui) ---
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
    body: JSON.stringify({ alunoId: aluno.user.id, name: "Treino Playwright E2E", letter: "A" }),
  });
  const workout = await workoutRes.json();

  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  });
  const exercisesData = await exercisesRes.json();

  const weRes = await fetch(`${BACKEND_URL}/api/workouts/${workout.workout.id}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalToken}` },
    body: JSON.stringify({
      exerciseId: exercisesData.exercises[0].id,
      sets: 3,
      repsRange: "8-12",
      restSeconds: 60,
      order: 1,
    }),
  });
  const workoutExercise = (await weRes.json()).workoutExercise;

  // --- 1. Login como aluno pela UI ---
  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Treino Playwright E2E/ })).toBeVisible();

  // --- 2. Ver o treino ---
  await page.getByRole("link", { name: "Começar treino" }).click();
  await expect(page).toHaveURL(new RegExp(`/treinos/${workout.workout.id}$`));
  await expect(page.getByText("0/3 séries")).toBeVisible();

  // --- 3. Registrar 1 série ---
  const repsInput = page.locator('input[type="number"]').nth(0);
  const weightInput = page.locator('input[type="number"]').nth(1);
  await repsInput.fill("10");
  await weightInput.fill("42.5");
  await page.getByRole("button", { name: "Registrar" }).click();

  await expect(page.getByText("1/3 séries")).toBeVisible();
  await expect(page.getByText(/10 reps × 42\.5kg/)).toBeVisible();

  // --- 4. Confirmar persistência real no backend (não é só estado local da UI) ---
  const backendCheck = await fetch(`${BACKEND_URL}/api/workouts/${workout.workout.id}`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  }).then((r) => r.json());

  const persistedLogs = backendCheck.workout.exercises.find(
    (e: { id: string }) => e.id === workoutExercise.id
  ).setLogs;

  expect(persistedLogs).toHaveLength(1);
  expect(persistedLogs[0]).toMatchObject({ setNumber: 1, repsDone: 10, weightKg: 42.5 });
});
