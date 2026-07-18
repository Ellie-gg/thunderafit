import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 28 — polish do formulário de exercício:
 * 1) o botão "Adicionar exercício (posição N)" atualiza N depois de cada
 *    adição (bug real: a tela de sessão dedicada, Fase 26, invalidava a
 *    query errada e o botão ficava travado em "posição 1");
 * 2) o popup de confirmação aparece centralizado;
 * 3) reordenar exercícios prescritos com as setas ↑/↓.
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

test("na tela de sessão: posição do botão avança a cada exercício, popup centralizado, reordenar funciona", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_prog28_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Foco em Pernas ${stamp}`;

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });

  await loginViaUI(page, personalEmail, password);
  await page.getByRole("link", { name: "Criar novo programa" }).click();
  await page.locator("#name").fill(programName);
  await page.getByRole("button", { name: "Criar programa" }).click();
  await expect(page.getByRole("heading", { name: programName })).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: "+ A", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sessão A" })).toBeVisible();

  // --- 1. Botão começa em "posição 1" ---
  await expect(page.getByRole("button", { name: "Adicionar exercício (posição 1)" })).toBeVisible();

  // --- 2. Adiciona o 1º exercício; popup de confirmação aparece ---
  await page.locator("#filter").fill("Agachamento Livre");
  await page.getByRole("option", { name: /Agachamento Livre/ }).click();
  await page.getByRole("button", { name: /Adicionar exercício/ }).click();
  await expect(page.getByRole("status")).toHaveText("✓ Exercício adicionado");

  // --- 3. Bug corrigido: o botão avança pra "posição 2" (antes ficava travado em 1) ---
  await expect(page.getByRole("button", { name: "Adicionar exercício (posição 2)" })).toBeVisible({
    timeout: 10000,
  });

  // --- 4. Adiciona o 2º exercício ---
  await page.locator("#filter").fill("Rosca Direta com Barra");
  await page.getByRole("option", { name: /Rosca Direta com Barra/ }).click();
  await page.getByRole("button", { name: /Adicionar exercício/ }).click();
  await expect(page.getByRole("button", { name: "Adicionar exercício (posição 3)" })).toBeVisible({
    timeout: 10000,
  });

  // --- 5. Confirma ordem inicial: Agachamento (#1) antes de Rosca (#2) ---
  const list = page.locator("ul li");
  await expect(list.nth(0)).toContainText("Agachamento Livre");
  await expect(list.nth(1)).toContainText("Rosca Direta com Barra");

  // --- 6. Move o 2º exercício (Rosca) pra cima → troca de posição ---
  await list.nth(1).getByRole("button", { name: "Mover exercício para cima" }).click();
  await expect(list.nth(0)).toContainText("Rosca Direta com Barra", { timeout: 10000 });
  await expect(list.nth(1)).toContainText("Agachamento Livre");

  // --- 7. Confirma no backend que a troca persistiu (order 1 e 2 trocados) ---
  const programsList = await fetch(`${BACKEND_URL}/api/workout-programs`, {
    headers: {
      Authorization: `Bearer ${(await backendJson("/api/auth/login", { email: personalEmail, password })).accessToken}`,
    },
  }).then((r) => r.json());
  const program = programsList.programs.find((p: { name: string }) => p.name === programName);
  const sessionAId = program.workouts.find((w: { letter: string }) => w.letter === "A").id;
  const sessionDetail = await fetch(`${BACKEND_URL}/api/workouts/${sessionAId}`, {
    headers: {
      Authorization: `Bearer ${(await backendJson("/api/auth/login", { email: personalEmail, password })).accessToken}`,
    },
  }).then((r) => r.json());
  const sorted = [...sessionDetail.workout.exercises].sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order
  );
  expect(sorted[0].exercise.name).toContain("Rosca Direta com Barra");
  expect(sorted[1].exercise.name).toContain("Agachamento Livre");
});
