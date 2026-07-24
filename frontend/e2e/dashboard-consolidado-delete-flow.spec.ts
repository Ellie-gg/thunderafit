import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 31:
 * 1) o dashboard do Personal agrupa "Treinos prescritos" por programa (não
 *    mais uma lista plana de sessões soltas) — cada card mostra só o nome do
 *    programa + quantas sessões tem; clicar abre a tela própria do programa
 *    (as sessões individuais deixaram de aparecer expandidas inline aqui,
 *    correção de UX pedida pelo fundador: card repetido por aluno vinculado
 *    ficava poluído);
 * 2) excluir um template (com confirmação) — some da lista de Templates;
 * 3) excluir uma instância aplicada a um aluno a partir do hub (com
 *    confirmação) — o backend realmente apaga tudo (programa, sessão,
 *    exercício, SetLog).
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

test("dashboard agrupa treinos prescritos por programa, sem expandir sessões inline", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_consol_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_consol_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Programa Agrupado ${stamp}`;

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  const program = await backendJson("/api/workout-programs", { name: programName }, personalLogin.accessToken);
  const templateId = program.program.id;
  await backendJson(`/api/workout-programs/${templateId}/sessions`, { letter: "A" }, personalLogin.accessToken);
  await backendJson(`/api/workout-programs/${templateId}/sessions`, { letter: "B" }, personalLogin.accessToken);
  // apply() cria uma CÓPIA (instância) com id PRÓPRIO, diferente do template
  // — é essa cópia que aparece no dashboard, não o template original.
  const applied = await backendJson(
    `/api/workout-programs/${templateId}/apply`,
    { alunoId: aluno.user.id },
    personalLogin.accessToken
  );
  const instanceId = applied.program.id;

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  // O card mostra só o nome do programa + quantas sessões tem — as sessões
  // individuais NÃO aparecem expandidas aqui (isso fica pra dentro da tela
  // do programa, aberta ao clicar). "2 sessão(ões)" confirma a contagem sem
  // precisar de um link por sessão.
  const group = page.locator("a", { hasText: programName }).first();
  await expect(group).toBeVisible({ timeout: 15000 });
  await expect(group.getByText(alunoEmail)).toBeVisible();
  await expect(group.getByText("2 sessão(ões)")).toBeVisible();

  await group.click();
  await expect(page).toHaveURL(new RegExp(`/personal/programas/${instanceId}$`));
});

test("Personal exclui um template com confirmação — some da lista", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_del_tpl_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Template Descartável ${stamp}`;

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  await page.goto("/personal/programas");
  await page.locator("#name").fill(programName);
  await page.getByRole("button", { name: "Criar programa" }).click();
  await expect(page.getByRole("heading", { name: programName })).toBeVisible({ timeout: 30000 });

  await page.goto("/personal/programas");
  await expect(page.getByText(programName)).toBeVisible({ timeout: 15000 });

  // Primeiro clique só abre a confirmação — o programa AINDA existe.
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByText(/Excluir este template\?/)).toBeVisible();
  await expect(page.getByText(programName)).toBeVisible();

  // Cancelar mantém o programa.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText(/Excluir este template\?/)).toHaveCount(0);
  await expect(page.getByText(programName)).toBeVisible();

  // Confirmar de verdade agora.
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await page.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(page.getByText(programName)).toHaveCount(0, { timeout: 15000 });
});

test("Personal exclui uma instância aplicada a partir do hub — backend apaga tudo (sessão, exercício, SetLog)", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_del_inst_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_del_inst_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Programa Pra Apagar ${stamp}`;

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const personalToken = personalLogin.accessToken;
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalToken);

  const program = await backendJson("/api/workout-programs", { name: programName }, personalToken);
  const programId = program.program.id;
  const session = await backendJson(`/api/workout-programs/${programId}/sessions`, { letter: "A" }, personalToken);
  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  }).then((r) => r.json());
  await backendJson(
    `/api/workouts/${session.session.id}/exercises`,
    { exerciseId: exercisesRes.exercises[0].id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 },
    personalToken
  );
  const applied = await backendJson(`/api/workout-programs/${programId}/apply`, { alunoId: aluno.user.id }, personalToken);
  const instanceId = applied.program.id;
  const instanceSessionId = applied.program.workouts[0].id;

  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  await backendJson(
    `/api/workouts/${instanceSessionId}/exercises/${applied.program.workouts[0].exercises[0].id}/logs`,
    { setNumber: 1, repsDone: 10, weightKg: 40 },
    alunoLogin.accessToken
  );

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto(`/personal/alunos/${aluno.user.id}`);
  await expect(page.getByText(programName)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByText(/histórico de séries registradas/)).toBeVisible();
  await page.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(page.getByText(programName)).toHaveCount(0, { timeout: 15000 });

  // Confirma no BACKEND que realmente sumiu tudo, não só da tela.
  const checkProgram = await fetch(`${BACKEND_URL}/api/workout-programs/${instanceId}`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  });
  expect(checkProgram.status).toBe(404);
});
