import type { Page } from "@playwright/test";

/**
 * Fase 24 (Parte 2): /login virou o fluxo unificado de e-mail (digita o
 * e-mail → check-email decide login ou cadastro). Quase todo spec E2E usa
 * login pela UI só como setup de outro fluxo — este helper reproduz os 2
 * passos (e-mail → Continuar → senha → Entrar) num lugar só, em vez de
 * duplicar o preenchimento em cada arquivo.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
