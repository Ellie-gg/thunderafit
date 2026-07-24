import { defineConfig, devices } from "@playwright/test";

/**
 * Usa o Chrome já instalado na máquina (channel: "chrome") em vez do Chromium
 * que o Playwright baixaria por padrão — evita depender de download de
 * binário grande neste ambiente. Requer Google Chrome instalado.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    // i18n: sem isso, o locale do Chrome deste ambiente gera um
    // Accept-Language que a detecção automática (`proxy.ts`) resolve pra
    // inglês — todo texto agora extraído pro next-intl mudaria de idioma
    // "à toa" em specs que nunca testaram i18n. pt-BR é o fallback real do
    // app sem escolha explícita, então é o default certo aqui também;
    // specs que precisam testar outro locale (ver e2e/i18n-flow.spec.ts)
    // já sobrescrevem via `browser.newContext({ locale: ... })`.
    locale: "pt-BR",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
