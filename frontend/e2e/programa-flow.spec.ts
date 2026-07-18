import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 16 — Programas de Treino, fluxo ponta a ponta:
 * Personal cria um programa (template) com 3 sessões via API, aplica a um
 * aluno, o aluno abre o programa pela UI, vê a sessão A sugerida, conclui a
 * sessão B (fora de ordem) e confirma que a sugestão continua correta (A, a
 * de menor letra ainda não feita) — sem travar a escolha de qualquer sessão.
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

test("Personal cria programa, aplica a aluno; aluno vê sugestão e conclui sessão fora de ordem", async ({
  page,
}) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_prog_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_prog_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const token = (await backendJson("/api/auth/login", { email: personalEmail, password })).accessToken;
  await backendJson("/api/relations", { alunoId: aluno.user.id }, token);

  // Template com 3 sessões (A, B, C).
  const tpl = await backendJson("/api/workout-programs", { name: "Programa E2E ABC" }, token);
  const programId = tpl.program.id;
  for (const letter of ["A", "B", "C"]) {
    await backendJson(`/api/workout-programs/${programId}/sessions`, { letter }, token);
  }
  // Aplica ao aluno → cópia independente.
  const applied = await backendJson(`/api/workout-programs/${programId}/apply`, { alunoId: aluno.user.id }, token);
  const appliedId = applied.program.id;
  const sessionByLetter: Record<string, string> = {};
  for (const w of applied.program.workouts) sessionByLetter[w.letter] = w.id;

  // Login como aluno pela UI.
  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Abre o programa aplicado.
  await page.goto(`/programas/${appliedId}`);
  await expect(page.getByRole("heading", { name: "Programa E2E ABC" })).toBeVisible({ timeout: 30000 });

  // Sessão A deve estar marcada como "Sugerida" (nenhuma feita ainda).
  const cardA = page.locator(`a[href="/treinos/${sessionByLetter.A}"]`);
  await expect(cardA.getByText("Sugerida")).toBeVisible();

  // Aluno abre a sessão B (fora de ordem) e conclui.
  await page.locator(`a[href="/treinos/${sessionByLetter.B}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/treinos/${sessionByLetter.B}$`));
  await page.getByRole("button", { name: "Concluir sessão" }).click();
  await expect(page.getByRole("button", { name: /Sessão concluída/ })).toBeVisible();

  // Volta ao programa: a sugestão continua sendo A (menor letra nunca feita),
  // e B não é mais a sugerida.
  await page.goto(`/programas/${appliedId}`);
  await expect(page.getByRole("heading", { name: "Programa E2E ABC" })).toBeVisible({ timeout: 30000 });
  const cardA2 = page.locator(`a[href="/treinos/${sessionByLetter.A}"]`);
  await expect(cardA2.getByText("Sugerida")).toBeVisible();
  const cardB2 = page.locator(`a[href="/treinos/${sessionByLetter.B}"]`);
  await expect(cardB2.getByText("Sugerida")).toHaveCount(0);

  // Confirma no backend que só a sessão B tem lastCompletedAt.
  const check = await fetch(`${BACKEND_URL}/api/workout-programs/${appliedId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const completed = check.program.workouts.filter((w: any) => w.lastCompletedAt);
  expect(completed).toHaveLength(1);
  expect(completed[0].letter).toBe("B");
});
