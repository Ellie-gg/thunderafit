import { test, expect } from "@playwright/test";

/**
 * Cenário multi-profissional (Fase 11, Bloco 4) — o caso central desta fase:
 * um único aluno vinculado simultaneamente a um Personal E a um
 * Nutricionista, com o dashboard do aluno mostrando os dois cards ao mesmo
 * tempo (próximo treino + plano alimentar de hoje), sem que um profissional
 * "vaze" dados do outro.
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

test("aluno com Personal E Nutricionista simultâneos vê os dois cards no dashboard", async ({ page }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_multi_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_multi_personal_${stamp}@thunderafit.test`;
  const nutriEmail = `e2e_pw_multi_nutri_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  // --- Setup via backend direto (não é o que está sob teste aqui) ---
  const aluno = await backendJson("/api/auth/register", {
    email: alunoEmail,
    password,
    role: "ALUNO",
  });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  await backendJson("/api/auth/register", { email: nutriEmail, password, role: "NUTRICIONISTA" });

  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const nutriLogin = await backendJson("/api/auth/login", { email: nutriEmail, password });

  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);
  await backendJson("/api/relations", { alunoId: aluno.user.id }, nutriLogin.accessToken);

  const workout = await backendJson(
    "/api/workouts",
    { alunoId: aluno.user.id, name: "Treino Multi-Profissional", letter: "A" },
    personalLogin.accessToken
  );

  const exercises = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalLogin.accessToken}` },
  }).then((r) => r.json());
  await backendJson(
    `/api/workouts/${workout.workout.id}/exercises`,
    { exerciseId: exercises.exercises[0].id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 },
    personalLogin.accessToken
  );

  const plan = await backendJson(
    "/api/diet-plans",
    { alunoId: aluno.user.id, name: "Plano Multi-Profissional" },
    nutriLogin.accessToken
  );
  const meal = await backendJson(
    `/api/diet-plans/${plan.plan.id}/meals`,
    { name: "Lanche", time: "16:00", order: 1 },
    nutriLogin.accessToken
  );

  const foods = await fetch(`${BACKEND_URL}/api/foods`, {
    headers: { Authorization: `Bearer ${nutriLogin.accessToken}` },
  }).then((r) => r.json());
  await backendJson(
    `/api/diet-plans/${plan.plan.id}/meals/${meal.meal.id}/foods`,
    { foodId: foods.foods[0].id, quantity: 1 },
    nutriLogin.accessToken
  );

  // --- Aluno loga e vê o dashboard unificado ---
  await page.goto("/login");
  await page.locator("#email").fill(alunoEmail);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Card do Personal (próximo treino)
  await expect(page.getByText("Próximo treino")).toBeVisible();
  await expect(page.getByText("Treino Multi-Profissional")).toBeVisible();

  // Card do Nutricionista (plano alimentar de hoje)
  await expect(page.getByText("Plano alimentar de hoje")).toBeVisible();
  await expect(page.getByText("Plano Multi-Profissional")).toBeVisible();

  // Abre o plano completo e confirma que os dados são do Nutricionista, não do Personal
  await page.getByRole("link", { name: "Ver plano completo" }).click();
  await expect(page).toHaveURL(/\/dieta\/[a-f0-9-]+$/);
  await expect(page.getByText("Lanche")).toBeVisible();
});
