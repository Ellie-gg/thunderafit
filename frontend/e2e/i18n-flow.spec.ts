import { test, expect } from "@playwright/test";
import { loginViaUI } from "./auth-helpers";

/**
 * i18n (PT/EN/ES) — prova de arquitetura ponta a ponta: detecção automática
 * via Accept-Language na primeira visita (cookie `locale`, setado pelo
 * `proxy.ts`), tela de Configurações trocando o idioma na hora + persistindo
 * em `User.locale` (sincroniza entre dispositivos), e o item novo no menu
 * hambúrguer. A tradução em massa do resto da UI/catálogo ainda não
 * aconteceu nesta fase — este spec valida só a FUNDAÇÃO (cookie, endpoint,
 * troca de idioma, next-intl renderizando de verdade), não o conteúdo final.
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

test("primeira visita com Accept-Language es detecta espanhol automaticamente (cookie locale)", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "es-ES" });
  const page = await context.newPage();
  await page.goto("/login");

  const cookies = await context.cookies();
  const localeCookie = cookies.find((c) => c.name === "locale");
  expect(localeCookie?.value).toBe("es");

  await context.close();
});

test("primeira visita com Accept-Language de idioma não suportado cai pro português", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();
  await page.goto("/login");

  const cookies = await context.cookies();
  const localeCookie = cookies.find((c) => c.name === "locale");
  expect(localeCookie?.value).toBe("pt");

  await context.close();
});

test("tela de Configurações: troca de idioma aplica na hora e persiste no banco (User.locale)", async ({
  browser,
}) => {
  const stamp = Date.now();
  const email = `e2e_i18n_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  await backendJson("/api/auth/register", { email, password, role: "ALUNO" });

  // Contexto com locale pt-BR explícito — o padrão do Chrome empacotado
  // (sem `locale` setado) pode já vir em inglês neste ambiente, o que faria
  // a detecção automática (Accept-Language) já abrir a tela em EN, mascarando
  // o que este teste quer provar: PT por padrão → troca pra EN pela UI.
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();

  await loginViaUI(page, email, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Item novo no menu hambúrguer (mobile), ao lado de Perfil/Sair.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  // Recarrega (SSR relê o cookie) e a MESMA tela agora vem em inglês.
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();

  // Persistiu no banco (User.locale), não só no cookie — login de novo confirma.
  const login = await backendJson("/api/auth/login", { email, password });
  expect(login.user.locale).toBe("EN");

  await context.close();
});
