import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Catálogo expandido + filtro por grupo muscular (Fase 15). Personal abre a
 * tela de um treino e usa o filtro por grupo muscular da AddExerciseForm,
 * confirmando que: (a) filtrar por "Peito" mostra só exercícios de Peito,
 * (b) cada exercício exibe o badge de dificuldade, (c) selecionar e adicionar
 * um exercício filtrado persiste no treino.
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

test("Personal filtra o catálogo por grupo muscular e adiciona um exercício de Peito", async ({
  page,
}) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_cat_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_cat_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const token = personalLogin.accessToken;
  await backendJson("/api/relations", { alunoId: aluno.user.id }, token);
  const workout = await backendJson(
    "/api/workouts",
    { alunoId: aluno.user.id, name: "Treino Catálogo E2E", letter: "A" },
    token
  );
  const workoutId = workout.workout.id;

  // Login como Personal pela UI
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // Vai direto para a tela do treino (timeout generoso: o Next dev pode
  // compilar a rota na primeira visita).
  await page.goto(`/personal/treinos/${workoutId}`);
  await expect(page.getByRole("heading", { name: "Adicionar exercício" })).toBeVisible({
    timeout: 30000,
  });

  const listbox = page.getByRole("listbox", { name: "Exercícios" });

  // Sem filtro: lista tem o catálogo inteiro (149).
  await expect(page.getByText("Exercício (149)")).toBeVisible();

  // Filtra por Peito → a contagem cai para 22 e só aparecem itens de Peito.
  await page.getByRole("button", { name: "Peito", exact: true }).click();
  await expect(page.getByText("Exercício (22)")).toBeVisible();

  // Badge de dificuldade visível em ao menos um exercício da lista filtrada.
  await expect(
    listbox.getByText(/Iniciante|Intermediário|Avançado/).first()
  ).toBeVisible();

  // Seleciona um exercício de Peito específico e adiciona ao treino.
  await listbox.getByRole("option", { name: /Supino Reto com Barra/ }).click();
  await page.getByRole("button", { name: /Adicionar exercício/ }).click();

  // Confirma persistência real no backend.
  await expect(async () => {
    const check = await fetch(`${BACKEND_URL}/api/workouts/${workoutId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    expect(check.workout.exercises.length).toBe(1);
    expect(check.workout.exercises[0].exercise.muscleGroup).toBe("Peito");
  }).toPass({ timeout: 5000 });
});
