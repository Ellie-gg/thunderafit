import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loginViaUI } from "./auth-helpers";

/**
 * Fase 62 — dois fluxos novos do Personal:
 * 1) "Gerenciar alunos" (tela própria, fora do dashboard) → hub do aluno →
 *    salvar a instância aplicada como um NOVO template → aplicar esse
 *    template a um SEGUNDO aluno (a única forma de reaproveitar o treino de
 *    um aluno pra outro, agora que aplicar uma instância direto é bloqueado).
 * 2) Tela "Templates de treino" (/personal/programas) com 3 seções — Meus
 *    Templates / Básico / Premium — aplicando um template Básico (curado
 *    pelo admin) direto a um aluno, e confirmando que Premium fica
 *    bloqueado num plano FREE e libera depois do upgrade pra Plus.
 */

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3000";
const ROOT_DIR = path.resolve(__dirname, "..", "..");

async function backendJson(p: string, body: unknown, token?: string, method = "POST") {
  const res = await fetch(`${BACKEND_URL}${p}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return res.json();
}

test("Gerenciar alunos → hub → salvar instância como template → aplicar a outro aluno", async ({ page }) => {
  const stamp = Date.now();
  const personalEmail = `e2e_savetpl_personal_${stamp}@thunderafit.test`;
  const alunoAEmail = `e2e_savetpl_aluno_a_${stamp}@thunderafit.test`;
  const alunoBEmail = `e2e_savetpl_aluno_b_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const programName = `Treino da Aluna A ${stamp}`;
  const newTemplateName = `Template Reaproveitado ${stamp}`;

  const alunoA = await backendJson("/api/auth/register", { email: alunoAEmail, password, role: "ALUNO" });
  const alunoB = await backendJson("/api/auth/register", { email: alunoBEmail, password, role: "ALUNO" });
  await backendJson("/api/auth/register", { email: personalEmail, password, role: "PERSONAL" });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: alunoA.user.id }, personalLogin.accessToken);
  await backendJson("/api/relations", { alunoId: alunoB.user.id }, personalLogin.accessToken);

  // --- Setup: template com 1 sessão, aplicado à aluna A ---
  const tpl = await backendJson("/api/workout-programs", { name: programName }, personalLogin.accessToken);
  await backendJson(`/api/workout-programs/${tpl.program.id}/sessions`, { letter: "A" }, personalLogin.accessToken);
  const applied = await backendJson(
    `/api/workout-programs/${tpl.program.id}/apply`,
    { alunoId: alunoA.user.id },
    personalLogin.accessToken
  );

  // --- Navega: dashboard → Gerenciar alunos → hub da aluna A ---
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.getByRole("link", { name: "Gerenciar alunos →" }).click();
  await expect(page).toHaveURL(/\/personal\/alunos$/);
  await expect(page.getByText(alunoAEmail)).toBeVisible({ timeout: 15000 });

  await page.locator("a", { hasText: alunoAEmail }).first().click();
  await expect(page).toHaveURL(new RegExp(`/personal/alunos/${alunoA.user.id}$`));
  await page.locator("a", { hasText: programName }).first().click();
  await expect(page).toHaveURL(new RegExp(`/personal/programas/${applied.program.id}$`));

  // --- "Aplicar a aluno" NÃO aparece pra uma instância — só "Salvar como template" ---
  await expect(page.getByRole("heading", { name: "Aplicar a um aluno" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Salvar como template" })).toBeVisible();

  await page.locator("input[placeholder='Nome do novo template']").fill(newTemplateName);
  await page.getByRole("button", { name: "Salvar como template" }).click();
  await expect(page.getByText(/Template ".*" criado — abrir →/)).toBeVisible({ timeout: 15000 });

  await page.getByText(/Template ".*" criado — abrir →/).click();
  await expect(page.getByRole("heading", { name: newTemplateName })).toBeVisible({ timeout: 15000 });

  // --- Agora o template novo PODE ser aplicado à aluna B ---
  await expect(page.getByRole("heading", { name: "Aplicar a um aluno" })).toBeVisible();
  await page.locator("select").selectOption({ label: alunoBEmail });
  await page.getByRole("button", { name: "Aplicar programa" }).click();
  await expect(page.getByText("Programa aplicado ao aluno.")).toBeVisible({ timeout: 15000 });
});

test("Templates de treino: aplica um Básico direto a um aluno; Premium fica bloqueado no plano Free e libera no Plus", async ({
  page,
}) => {
  const stamp = Date.now();
  const adminEmail = `e2e_catalogo_admin_${stamp}@thunderafit.test`;
  const personalEmail = `e2e_catalogo_personal_${stamp}@thunderafit.test`;
  const alunoEmail = `e2e_catalogo_aluno_${stamp}@thunderafit.test`;
  const password = "SenhaSegura@123";
  const basicoName = `Básico E2E ${stamp}`;

  const aluno = await backendJson("/api/auth/register", { email: alunoEmail, password, role: "ALUNO" });
  const personalReg = await backendJson("/api/auth/register", {
    email: personalEmail,
    password,
    role: "PERSONAL",
  });
  const personalLogin = await backendJson("/api/auth/login", { email: personalEmail, password });
  await backendJson("/api/relations", { alunoId: aluno.user.id }, personalLogin.accessToken);

  execFileSync("npm", ["run", "db:seed:admin"], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: password },
  });
  const adminLogin = await backendJson("/api/auth/login", { email: adminEmail, password });

  // --- Admin cadastra um template Básico (origin: PERSONAL_CATALOG) ---
  const basico = await backendJson(
    "/api/admin/self-templates",
    { name: basicoName, origin: "PERSONAL_CATALOG" },
    adminLogin.accessToken
  );
  await backendJson(
    `/api/admin/self-templates/${basico.program.id}/sessions`,
    { letter: "A" },
    adminLogin.accessToken
  );

  // --- Personal vê os 3 catálogos em /personal/programas ---
  await loginViaUI(page, personalEmail, password);
  await expect(page).toHaveURL(/\/personal\/dashboard$/);
  await page.goto("/personal/programas");
  await expect(page.getByRole("heading", { name: "Templates Básico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Templates Premium" })).toBeVisible();

  // --- Aplica o Básico direto a um aluno (preview → seleciona aluno → aplica) ---
  await page.getByText(basicoName).click();
  await page.locator("select").last().selectOption({ label: alunoEmail });
  await page.getByRole("button", { name: "Aplicar este treino" }).click();
  // O card do catálogo continua na lista (é o admin quem cura o catálogo,
  // aplicar não o remove) — o sinal de sucesso é o diálogo de preview
  // fechar.
  await expect(page.getByRole("button", { name: "Aplicar este treino" })).toHaveCount(0, {
    timeout: 15000,
  });

  const alunoLogin = await backendJson("/api/auth/login", { email: alunoEmail, password });
  const alunoPrograms = await fetch(`${BACKEND_URL}/api/workout-programs`, {
    headers: { Authorization: `Bearer ${alunoLogin.accessToken}` },
  }).then((r) => r.json());
  expect(alunoPrograms.programs.some((p: { name: string }) => p.name === basicoName)).toBe(true);

  // --- Premium: bloqueado no plano Free ---
  await page.reload();
  await expect(page.getByText("Assine o plano Plus para prescrever estes templates")).toBeVisible({
    timeout: 15000,
  });

  // --- Fase 64: clicar num template Premium bloqueado redireciona pra
  // compra do plano, com aviso específico de qual plano libera ---
  const premiumCatalog = await backendJson(
    "/api/workout-programs/personal-catalog",
    null,
    personalLogin.accessToken,
    "GET"
  );
  const premiumTemplateName = premiumCatalog.programs.find(
    (p: { tier: string }) => p.tier === "PREMIUM"
  ).name;
  await page.getByText(premiumTemplateName).first().click();
  await expect(page).toHaveURL(/\/personal\/upgrade\?from=templates$/);
  await expect(
    page.getByText("Templates Premium são exclusivos do plano Plus")
  ).toBeVisible({ timeout: 15000 });

  // --- Admin concede Plus ao Personal → Premium libera ---
  await fetch(`${BACKEND_URL}/api/admin/users/${personalReg.user.id}/premium`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminLogin.accessToken}`,
    },
    body: JSON.stringify({ active: true }),
  });

  await page.goto("/personal/programas");
  await expect(page.getByText("Assine o plano Plus para prescrever estes templates")).toHaveCount(0, {
    timeout: 15000,
  });

  // Com Plus, clicar num template Premium agora abre o preview (não redireciona).
  await page.getByText(premiumTemplateName).first().click();
  await expect(page.getByRole("button", { name: "Aplicar este treino" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page).toHaveURL(/\/personal\/programas$/);
});
