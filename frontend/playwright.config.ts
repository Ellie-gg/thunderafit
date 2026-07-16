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
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
