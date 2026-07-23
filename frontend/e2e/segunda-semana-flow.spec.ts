import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 40: bug real corrigido — o mesmo Workout/WorkoutExercise é reaberto
 * toda semana (nunca recriado a cada ciclo), e `setLogs` sempre trouxe o
 * histórico INTEIRO de todas as semanas. Sem o corte por
 * `Workout.lastCompletedAt`, depois da 1ª semana completa o formulário de
 * registro ficava escondido pra sempre (achando que as séries já tinham
 * sido feitas, quando eram só as da semana anterior). Este teste reproduz
 * exatamente 2 ciclos (semana 1 → conclui → semana 2) pra provar que o
 * aluno consegue registrar séries novas de novo.
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

test("segunda semana do mesmo treino: formulário volta a aparecer e mostra referência da semana anterior", async ({
  page,
}) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_semana2_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_semana2_personal_${stamp}@thunderafit.test`;
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
    body: JSON.stringify({ alunoId: aluno.user.id, name: "Treino Semana 2 E2E", letter: "A" }),
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

  // --- Semana 1: registra a série prescrita e conclui a sessão ---
  const repsInput = page.locator('input[type="number"]').nth(0);
  const weightInput = page.locator('input[type="number"]').nth(1);
  await repsInput.fill("10");
  await weightInput.fill("50");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("1/1 séries")).toBeVisible();
  await expect(page.getByRole("button", { name: /registrar/i })).not.toBeVisible();

  await page.getByRole("button", { name: "Concluir sessão" }).click();
  await expect(page.getByText(/mandou bem no treino/)).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // --- Semana 2: reabre a MESMA sessão (nova navegação = novo mount) ---
  await page.goto(`/treinos/${workout.workout.id}`);

  // Bug corrigido: sem o corte por sessionBoundary, isto ficaria "1/1
  // séries" pra sempre e o formulário nunca mais apareceria.
  await expect(page.getByText("0/1 séries")).toBeVisible();
  await expect(page.getByRole("button", { name: /registrar/i })).toBeVisible();
  await expect(page.getByText("Última vez: 10 reps × 50kg")).toBeVisible();

  const repsInput2 = page.locator('input[type="number"]').nth(0);
  const weightInput2 = page.locator('input[type="number"]').nth(1);
  await repsInput2.fill("12");
  await weightInput2.fill("52.5");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("1/1 séries")).toBeVisible();

  // Confirma no backend: agora existem 2 SetLogs pro mesmo workoutExercise
  // (semana 1 + semana 2), não substituição nem perda de histórico.
  const check = await fetch(`${BACKEND_URL}/api/workouts/${workout.workout.id}`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  }).then((r) => r.json());
  expect(check.workout.exercises[0].setLogs).toHaveLength(2);
});
