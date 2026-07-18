import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 25/26 — fluxo de criação de treino do Personal: cria o WorkoutProgram
 * primeiro, cada sessão tem sua PRÓPRIA tela de prescrição (não mais um
 * acordeão inline), com um botão "Próximo" que cria e abre a sessão seguinte
 * da sequência do esquema escolhido (Letras A-E ou Dias da semana), e aplica
 * o programa como template a um aluno vinculado — tudo pela UI real, contra
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

test("esquema Letras: Personal cria programa, percorre A→E via Próximo, prescreve e aplica como template", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_prog_letra_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_prog_letra_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Foco em Peito ${stamp}`;

  const aluno = await backendJson("/api/auth/register", {
    email: alunoEmail,
    password,
    role: "ALUNO",
  });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  // --- 1. Login e cria o programa (esquema Letras é o padrão) ---
  await loginViaUI(page, personalEmail, password);
  await page.getByRole("link", { name: "Criar novo programa" }).click();
  await page.locator("#name").fill(programName);
  await page.locator("#targetAluno").selectOption({ label: alunoEmail });
  await page.getByRole("button", { name: "Criar programa" }).click();
  await expect(page).toHaveURL(/\/personal\/programas\/[a-f0-9-]+\?alunoId=/);
  await expect(page.getByRole("heading", { name: programName })).toBeVisible({ timeout: 30000 });

  // --- 2. Abre a sessão A (tela própria) e prescreve um exercício ---
  await page.getByRole("button", { name: "+ A", exact: true }).click();
  await expect(page).toHaveURL(/\/sessoes\/[a-f0-9-]+\?alunoId=/);
  await expect(page.getByRole("heading", { name: "Sessão A" })).toBeVisible();
  await page.locator("#filter").fill("Supino Reto com Barra");
  await page.getByRole("option", { name: /Supino Reto com Barra/ }).click();
  await page.getByRole("button", { name: /Adicionar exercício/ }).click();
  await expect(page.getByText(/Supino Reto com Barra/).first()).toBeVisible();

  // --- 3. "Próximo" percorre B→C→D→E, criando cada sessão na hora (nenhuma
  // existe ainda, então o botão sempre cria — nunca é um link nesta cadeia) ---
  for (const letter of ["B", "C", "D", "E"]) {
    await page.getByRole("button", { name: `Próximo: ${letter} →` }).click();
    await expect(page.getByRole("heading", { name: `Sessão ${letter}` })).toBeVisible();
  }
  // Na última sessão (E) não há mais "Próximo".
  await expect(page.getByRole("link", { name: /Próximo:/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Próximo:/ })).toHaveCount(0);

  // --- 4. Volta ao programa: as 5 sessões existem ---
  await page.getByRole("link", { name: "← Voltar ao programa" }).first().click();
  await expect(page).toHaveURL(/\/personal\/programas\/[a-f0-9-]+\?alunoId=/);
  await expect(page.getByText("5/5 sessão(ões)")).toBeVisible();
  await expect(page.getByText("Adicionar sessão")).toHaveCount(0);

  // --- 5. Aplica o programa — select já pré-preenchido com o aluno-alvo ---
  await expect(page.locator("select")).toHaveValue(aluno.user.id);
  await page.getByRole("button", { name: "Aplicar programa" }).click();
  await expect(page.getByText("Programa aplicado ao aluno.")).toBeVisible();

  // --- 6. Confirma no backend: cópia de 5 sessões A-E, com o exercício em A ---
  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  const alunoPrograms = await fetch(`${BACKEND_URL}/api/workout-programs`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  const applied = alunoPrograms.programs.find((p: { name: string }) => p.name === programName);
  expect(applied).toBeDefined();
  expect(applied.workouts.map((w: { letter: string }) => w.letter).sort()).toEqual([
    "A",
    "B",
    "C",
    "D",
    "E",
  ]);

  const sessionAId = applied.workouts.find((w: { letter: string }) => w.letter === "A").id;
  const sessionADetail = await fetch(`${BACKEND_URL}/api/workouts/${sessionAId}`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  expect(
    sessionADetail.workout.exercises.some((e: { exercise: { name: string } }) =>
      e.exercise.name.includes("Supino Reto com Barra")
    )
  ).toBe(true);
});

test("esquema Dias da semana: sessão adicionada fora de ordem (Quarta antes de Segunda) sugere Segunda primeiro", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_prog_dia_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_prog_dia_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Semana Completa ${stamp}`;

  const aluno = await backendJson("/api/auth/register", {
    email: alunoEmail,
    password,
    role: "ALUNO",
  });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  // --- 1. Cria o programa escolhendo o esquema "Dias da semana" ---
  await loginViaUI(page, personalEmail, password);
  await page.getByRole("link", { name: "Criar novo programa" }).click();
  await page.locator("#name").fill(programName);
  await page.getByRole("button", { name: "Dias da semana" }).click();
  await page.locator("#targetAluno").selectOption({ label: alunoEmail });
  await page.getByRole("button", { name: "Criar programa" }).click();
  await expect(page.getByRole("heading", { name: programName })).toBeVisible({ timeout: 30000 });

  // --- 2. Adiciona Quarta primeiro (fora da ordem do calendário) ---
  await page.getByRole("button", { name: "+ Quarta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sessão Quarta" })).toBeVisible();
  await page.getByRole("link", { name: "← Voltar ao programa" }).first().click();

  // --- 3. Adiciona Segunda depois ---
  await page.getByRole("button", { name: "+ Segunda", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sessão Segunda" })).toBeVisible();
  await page.getByRole("link", { name: "← Voltar ao programa" }).first().click();
  await expect(page.getByText("2/7 sessão(ões)")).toBeVisible();

  // --- 4. Aplica ao aluno e confirma no backend que a sugestão é Segunda, não Quarta ---
  await expect(page.locator("select")).toHaveValue(aluno.user.id);
  await page.getByRole("button", { name: "Aplicar programa" }).click();
  await expect(page.getByText("Programa aplicado ao aluno.")).toBeVisible();

  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  const alunoPrograms = await fetch(`${BACKEND_URL}/api/workout-programs`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  const applied = alunoPrograms.programs.find((p: { name: string }) => p.name === programName);
  expect(applied.sessionScheme).toBe("WEEKDAY");

  const programDetail = await fetch(`${BACKEND_URL}/api/workout-programs/${applied.id}`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  const suggested = programDetail.program.workouts.filter((w: { suggestedNext: boolean }) => w.suggestedNext);
  expect(suggested).toHaveLength(1);
  expect(suggested[0].letter).toBe("SEGUNDA");
});
