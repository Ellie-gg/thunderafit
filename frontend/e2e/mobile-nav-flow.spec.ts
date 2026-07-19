import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";

async function backendJson(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Fase 33.2: bug real reportado pelo fundador testando no celular — os
 * links de navegação do AppHeader (Programas/Evolução/Anamnese/etc) eram só
 * `sm:inline`, então no mobile não existia NENHUM jeito de navegar entre
 * seções além do botão voltar do navegador. Corrigido com um menu
 * hambúrguer (`sm:hidden`) que cobre os mesmos links.
 */
test("no celular, o menu hambúrguer do header dá acesso aos links de navegação", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // largura típica de celular

  const stamp = Date.now();
  const email = `e2e_pw_mobile_nav_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email, password, role: "ALUNO" });

  await loginViaUI(page, email, password);

  // Os links de texto do header (versão desktop) ficam ocultos no mobile.
  await expect(page.getByRole("link", { name: "Programas", exact: true })).toBeHidden();

  // O botão hambúrguer abre o menu com os mesmos links.
  const menuButton = page.getByRole("button", { name: "Abrir menu de navegação" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const menu = page.getByRole("navigation");
  await expect(menu.getByRole("link", { name: "Programas" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Evolução" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Anamnese" })).toBeVisible();

  await menu.getByRole("link", { name: "Evolução" }).click();
  await expect(page).toHaveURL(/\/evolucao$/);
});
