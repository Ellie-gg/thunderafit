import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 30 — foto de perfil (aluno e Personal): upload real (via
 * setInputFiles, sem precisar de arquivo de fixture no repo), confirma que
 * aparece no AppHeader (persistido de verdade no backend, não só otimista),
 * e que "Remover" volta pro fallback com a inicial do e-mail.
 */

// 1x1 PNG válido — mesmo usado nos testes de backend.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function backendJson(path: string, body: unknown, token?: string) {
  const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";
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

test("aluno sobe foto de perfil em /perfil, ela aparece no AppHeader e persiste após reload", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `e2e_avatar_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email, password, role: "ALUNO" });

  await loginViaUI(page, email, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  // --- Sem foto ainda: nenhuma <img> de avatar (fallback é só texto) ---
  await expect(page.locator("img")).toHaveCount(0);

  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();

  // --- Upload real (input escondido, sem precisar clicar no botão) ---
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
  });

  // Depois do upload, aparece uma <img> real (não mais o fallback de texto).
  await expect(page.locator("img").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Remover" })).toBeVisible();

  // --- Persistiu de verdade: recarrega a página e a foto continua lá ---
  await page.reload();
  await expect(page.locator("img").first()).toBeVisible({ timeout: 15000 });

  // --- Remover volta pro fallback ---
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  await expect(page.locator("img")).toHaveCount(0);
});

test("Personal sobe foto de perfil em /personal/perfil", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e_avatar_personal_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email, password, role: "PERSONAL" });

  await loginViaUI(page, email, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);

  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page).toHaveURL(/\/personal\/perfil$/);

  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
  });
  await expect(page.locator("img").first()).toBeVisible({ timeout: 15000 });
});
