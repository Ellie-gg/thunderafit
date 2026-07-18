import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 29 — hub de administração do aluno: o Personal cria um programa e
 * antes não tinha pra onde voltar pra ver o que prescreveu, acompanhar
 * evolução ou acessar anamnese. Prova ponta a ponta que
 * /personal/alunos/[alunoId] reúne as três coisas, reaproveitando telas e
 * endpoints já existentes (nenhuma duplicação de formulário).
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

test("Personal abre o hub do aluno pelo dashboard, vê o programa aplicado e a evolução real", async ({
  page,
}) => {
  const stamp = Date.now();
  const personalEmail = `e2e_hub_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_hub_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Foco em Costas ${stamp}`;

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  const alunoId = aluno.user.id;
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const personalToken = personalLogin.accessToken;
  await backendJson("/api/relations", { alunoId }, personalToken);

  // --- Setup via backend: programa aplicado ao aluno com 1 exercício ---
  const program = await backendJson("/api/workout-programs", { name: programName }, personalToken);
  const programId = program.program.id;
  const session = await backendJson(
    `/api/workout-programs/${programId}/sessions`,
    { letter: "A" },
    personalToken
  );
  const exercisesRes = await fetch(`${BACKEND_URL}/api/exercises`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  }).then((r) => r.json());
  const exercise = exercisesRes.exercises[0];
  await backendJson(
    `/api/workouts/${session.session.id}/exercises`,
    { exerciseId: exercise.id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 },
    personalToken
  );
  const applied = await backendJson(`/api/workout-programs/${programId}/apply`, { alunoId }, personalToken);
  const appliedSessionId = applied.program.workouts[0].id;
  const appliedExerciseId = applied.program.workouts[0].exercises[0].id;

  // Aluno registra uma série real — prova que o gráfico de evolução no hub
  // reflete dado de verdade, não um mock.
  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  await backendJson(
    `/api/workouts/${appliedSessionId}/exercises/${appliedExerciseId}/logs`,
    { setNumber: 1, repsDone: 10, weightKg: 42 },
    alunoLogin.accessToken
  );

  // --- Personal navega pelo dashboard até o hub (não digita a URL direto) ---
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.getByRole("link", { name: "Gerenciar →" }).click();
  await expect(page).toHaveURL(new RegExp(`/personal/alunos/${alunoId}$`));

  // --- Cabeçalho do aluno ---
  await expect(page.getByRole("heading", { name: alunoEmail })).toBeVisible();
  await expect(page.getByText(/Vinculado desde/)).toBeVisible();

  // --- Seção de programas: o programa aplicado aparece, linkando pro detalhe ---
  await expect(page.getByText(programName)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("1 sessão(ões)")).toBeVisible();

  // --- Seção de evolução: select com o exercício populado, gráfico renderiza ---
  const exerciseSelect = page.locator("select");
  await expect(exerciseSelect).toBeVisible({ timeout: 30000 });
  await expect(exerciseSelect.locator("option", { hasText: exercise.name })).toHaveCount(1);
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
  await expect(page.getByText("1 treino(s) nos últimos 6 meses")).toBeVisible();

  // --- Link de anamnese continua acessível a partir do hub ---
  await expect(page.getByRole("link", { name: "Ver anamnese →" })).toHaveAttribute(
    "href",
    `/personal/alunos/${alunoId}/anamnese`
  );

  // --- Confirma no backend que o filtro ?alunoId= realmente restringiu ao aluno certo ---
  const filtered = await fetch(`${BACKEND_URL}/api/workout-programs?alunoId=${alunoId}`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  }).then((r) => r.json());
  expect(filtered.programs.every((p: { alunoId: string }) => p.alunoId === alunoId)).toBe(true);
});

test("hub bloqueia acesso a aluno não vinculado", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_hub_bloq_personal_${stamp}@thunderafit.test`;
  const outroAlunoEmail = `e2e_hub_bloq_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const outroAluno = await backendJson("/api/auth/register", {
    email: outroAlunoEmail,
    password,
    role: "ALUNO",
  });

  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto(`/personal/alunos/${outroAluno.user.id}`);
  await expect(
    page.getByText("Este aluno não está vinculado a você (ou o link está incorreto).")
  ).toBeVisible();
});
