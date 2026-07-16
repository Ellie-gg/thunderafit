import { test, expect } from "@playwright/test";

/**
 * Fluxo de Dúvidas (Fase 10) — o mais interativo dos três blocos, envolvendo
 * dois usuários reais (aluno e Personal) em duas sessões de navegador
 * separadas: aluno pergunta → Personal responde → aluno vê a resposta E a
 * notificação in-app, tudo contra backend + Postgres reais, sem mocks.
 *
 * Requer o backend + Postgres rodando de verdade (ver frontend/README.md).
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

test("aluno pergunta → Personal responde → aluno vê resposta e notificação", async ({ browser }) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_duvida_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_duvida_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const subject = `Dúvida E2E ${stamp}`;

  // --- Setup: personal + aluno vinculados (não é o que está sob teste aqui) ---
  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  const personalToken = personalLogin.accessToken;

  await fetch(`${BACKEND_URL}/api/relations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalToken}` },
    body: JSON.stringify({ alunoId: aluno.user.id }),
  });

  // --- Duas sessões de navegador separadas (cookies independentes) ---
  const alunoContext = await browser.newContext();
  const personalContext = await browser.newContext();
  const alunoPage = await alunoContext.newPage();
  const personalPage = await personalContext.newPage();

  // --- 1. Aluno loga e envia uma dúvida ---
  await alunoPage.goto("/login");
  await alunoPage.locator("#email").fill(alunoEmail);
  await alunoPage.locator("#password").fill(password);
  await alunoPage.getByRole("button", { name: "Entrar" }).click();
  await expect(alunoPage).toHaveURL(/\/dashboard$/);

  await alunoPage.getByRole("link", { name: "Dúvidas" }).click();
  await expect(alunoPage).toHaveURL(/\/duvidas$/);
  await alunoPage.getByRole("button", { name: "Nova dúvida" }).click();
  await alunoPage.locator("#subject").fill(subject);
  await alunoPage.locator("#message").fill("Sinto dor no ombro durante o supino, é normal?");
  await alunoPage.getByRole("button", { name: "Enviar dúvida" }).click();

  await expect(alunoPage.getByText(subject)).toBeVisible();
  await expect(alunoPage.getByText("Aberto")).toBeVisible();

  // --- 2. Personal loga, vê a dúvida em "Abertas" e responde ---
  await personalPage.goto("/login");
  await personalPage.locator("#email").fill(personalEmail);
  await personalPage.locator("#password").fill(password);
  await personalPage.getByRole("button", { name: "Entrar" }).click();
  await expect(personalPage).toHaveURL(/\/personal\/dashboard$/);

  await personalPage.getByRole("link", { name: "Dúvidas" }).click();
  await expect(personalPage).toHaveURL(/\/personal\/duvidas$/);
  await expect(personalPage.getByText(subject)).toBeVisible();

  await personalPage.getByText(subject).click();
  await expect(personalPage.getByText("Sinto dor no ombro durante o supino, é normal?")).toBeVisible();

  await personalPage
    .locator("textarea")
    .fill("Sim, ajuste a pegada e reduza a carga por uma semana.");
  await personalPage.getByRole("button", { name: "Enviar" }).click();
  await expect(personalPage.getByText("Respondido")).toBeVisible();

  // --- 3. Aluno recarrega a lista e vê a resposta + status atualizado ---
  await alunoPage.goto("/duvidas");
  await expect(alunoPage.getByText("Respondido")).toBeVisible();
  await alunoPage.getByText(subject).click();
  await expect(
    alunoPage.getByText("Sim, ajuste a pegada e reduza a carga por uma semana.")
  ).toBeVisible();

  // --- 4. Aluno vê a notificação in-app, abre e ela marca como lida ---
  await alunoPage.goto("/dashboard");
  const bellButton = alunoPage.getByRole("button", { name: "Notificações" });
  await expect(bellButton.locator("span")).toContainText("1");
  await bellButton.click();
  await expect(alunoPage.getByText(`Sua dúvida "${subject}" foi respondida.`)).toBeVisible();
  await alunoPage.getByText(`Sua dúvida "${subject}" foi respondida.`).click();

  // Depois de marcar como lida, o badge de não lidas some.
  await expect(bellButton.locator("span")).toHaveCount(0);

  await alunoContext.close();
  await personalContext.close();
});
