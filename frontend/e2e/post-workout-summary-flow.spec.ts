import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 35: ao concluir uma sessão, o card de resumo pós-treino aparece com o
 * volume calculado e permite baixar a imagem (mesmo componente exportado
 * como PNG via html-to-image). Requer backend + Postgres + frontend
 * rodando de verdade — mesmo setup do critical-flow.spec.ts.
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

test("concluir treino → mostra o card de resumo pós-treino e permite baixar a imagem", async ({ page }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_summary_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_summary_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

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
    body: JSON.stringify({ alunoId: aluno.user.id, name: "Treino Resumo E2E", letter: "B" }),
  });
  const workout = await workoutRes.json();

  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  });
  const exercisesData = await exercisesRes.json();

  await fetch(`${BACKEND_URL}/api/workouts/${workout.workout.id}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalToken}` },
    body: JSON.stringify({
      exerciseId: exercisesData.exercises[0].id,
      sets: 1,
      repsRange: "8-12",
      restSeconds: 60,
      order: 1,
    }),
  });

  await loginViaUI(page, alunoEmail, password);
  await page.getByRole("link", { name: "Começar treino" }).click();
  await expect(page).toHaveURL(new RegExp(`/treinos/${workout.workout.id}$`));

  const repsInput = page.locator('input[type="number"]').nth(0);
  const weightInput = page.locator('input[type="number"]').nth(1);
  await repsInput.fill("10");
  await weightInput.fill("50");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("1/1 séries")).toBeVisible();

  await page.getByRole("button", { name: "Concluir sessão" }).click();

  // Card de resumo: primeira conclusão deste Workout → framing "primeira vez",
  // volume calculado a partir da série registrada (10 reps × 50kg = 500kg),
  // hero mostra a contagem de séries (1).
  await expect(page.getByText(/Primeiro treino de Treino Resumo E2E registrado/)).toBeVisible();
  await expect(page.getByText("Séries registradas")).toBeVisible();
  await expect(page.getByText(/500/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar imagem" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("thunderafit-treino-B");

  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText(/Primeiro treino de Treino Resumo E2E registrado/)).not.toBeVisible();
});
