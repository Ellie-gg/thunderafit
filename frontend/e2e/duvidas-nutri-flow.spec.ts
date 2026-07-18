import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 17 (Item 6) — Dúvidas simétricas ao Nutricionista, ponta a ponta:
 * um aluno vinculado a Personal E Nutricionista abre uma dúvida escolhendo o
 * Nutricionista como destinatário; o Nutricionista vê a thread na sua caixa e
 * responde; a thread fica "Respondido".
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

test("aluno abre dúvida com o Nutricionista e o Nutricionista responde pela UI", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_dn_personal_${stamp}@thunderafit.test`;
  const nutriEmail = `e2e_dn_nutri_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_dn_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  await backendJson("/api/auth/register", { email: nutriEmail, password, role: "NUTRICIONISTA" });
  const personalToken = (await backendJson("/api/auth/login", { email: personalEmail, password })).accessToken;
  const nutriToken = (await backendJson("/api/auth/login", { email: nutriEmail, password })).accessToken;
  // Aluno vinculado aos DOIS profissionais.
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalToken);
  await backendJson("/api/relations", { alunoId: aluno.user.id }, nutriToken);

  // --- Aluno abre a dúvida pela UI, escolhendo o Nutricionista ---
  await loginViaUI(page, alunoEmail, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/duvidas");
  await page.getByRole("button", { name: "Nova dúvida" }).click();
  // Como há 2 profissionais, aparece o select de destinatário com rótulos.
  await page.getByLabel("Destinatário").selectOption({ label: `Nutricionista — ${nutriEmail}` });
  await page.getByLabel("Assunto").fill("Posso trocar arroz por batata?");
  await page.getByLabel("Mensagem").fill("Estou na dúvida sobre a substituição de carboidrato.");
  await page.getByRole("button", { name: "Enviar dúvida" }).click();
  await expect(page.getByText("Posso trocar arroz por batata?")).toBeVisible();

  // --- Nutricionista loga, vê e responde a dúvida ---
  await loginViaUI(page, nutriEmail, password);
  await expect(page).toHaveURL(/\/nutricionista\/dashboard$/);

  await page.goto("/nutricionista/duvidas");
  await expect(page.getByText("Posso trocar arroz por batata?")).toBeVisible({ timeout: 30000 });
  await page.getByText("Posso trocar arroz por batata?").click();
  await expect(page).toHaveURL(/\/nutricionista\/duvidas\/[0-9a-f-]+$/);
  const threadId = page.url().split("/").pop()!;

  // Responde.
  await page.getByRole("textbox").fill("Pode sim, mantendo a porção de carboidrato.");
  await page.getByRole("button", { name: /Responder|Enviar/ }).click();
  await expect(page.getByText("Pode sim, mantendo a porção de carboidrato.")).toBeVisible();
  // Badge da thread muda para "Respondido" na própria UI.
  await expect(page.getByText("Respondido")).toBeVisible();

  // Confirma no backend, na thread EXATA (por id), que ficou RESPONDIDO.
  const thread = await fetch(`${BACKEND_URL}/api/support/threads/${threadId}`, {
    headers: { Authorization: `Bearer ${nutriToken}` },
  }).then((r) => r.json());
  expect(thread.thread.status).toBe("RESPONDIDO");
});
