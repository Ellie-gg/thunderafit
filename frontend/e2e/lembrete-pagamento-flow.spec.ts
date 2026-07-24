import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Lembrete de pagamento (MASTER_SPEC) — o Personal define uma data de
 * cobrança (com recorrência mensal opcional) no hub do aluno; ao logar na
 * data (ou depois), o aluno recebe UMA notificação in-app via o sino já
 * existente. Sem processamento de pagamento real. Duas sessões de navegador
 * separadas (mesmo padrão de duvidas-flow.spec.ts), já que envolve o
 * Personal configurando e o aluno recebendo em contas diferentes.
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

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

test("Personal configura lembrete de pagamento vencido; aluno vê a notificação no próximo login", async ({
  browser,
}) => {
  const stamp = Date.now();
  const alunoEmail = `e2e_pw_lembrete_aluno_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_pw_lembrete_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  // --- Setup: personal + aluno vinculados (não é o que está sob teste aqui) ---
  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  const personalContext = await browser.newContext();
  const alunoContext = await browser.newContext();
  const personalPage = await personalContext.newPage();
  const alunoPage = await alunoContext.newPage();

  // --- Personal configura o lembrete pela UI, com vencimento JÁ passado ---
  await loginViaUI(personalPage, personalEmail, password);
  await expect(personalPage).toHaveURL(/\/personal\/dashboard$/);
  await personalPage.goto(`/personal/alunos/${aluno.user.id}`);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await personalPage.locator('input[type="date"]').fill(toDateInputValue(yesterday));
  await personalPage.getByRole("button", { name: "Salvar lembrete" }).click();
  await expect(personalPage.getByText(/Próximo lembrete:/)).toBeVisible();

  // --- Aluno loga (sessão separada) e vê a notificação disparada no login ---
  await loginViaUI(alunoPage, alunoEmail, password);
  await expect(alunoPage).toHaveURL(/\/dashboard$/);

  const bellButton = alunoPage.getByRole("button", { name: "Notificações" });
  await expect(bellButton.locator("span")).toContainText("1");
  await bellButton.click();
  await expect(alunoPage.getByText(/dia de acertar o pagamento combinado/)).toBeVisible();

  // --- Personal recarrega o hub: lembrete não-recorrente some da tela ---
  await personalPage.reload();
  await expect(personalPage.getByText(/Próximo lembrete:/)).toHaveCount(0);
  await expect(personalPage.getByRole("button", { name: "Salvar lembrete" })).toBeVisible();

  await personalContext.close();
  await alunoContext.close();
});
