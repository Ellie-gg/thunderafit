import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let adminToken: string;
let personalToken: string;
let alunoToken: string;
let alunoId: string;

const pw = "SenhaSegura@123";

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "aluno_premium_admin@thunderafit.test",
          "aluno_premium_personal@thunderafit.test",
          "aluno_premium_aluno@thunderafit.test",
        ],
      },
    },
  });
  // A2 (auditoria 2026-08-06): o template do fixture agora tem sessão (exigida
  // pra ser aplicável), e `Workout.programId` NÃO tem cascade — apagar o
  // programa direto viola a FK. Apaga as sessões primeiro.
  await prisma.workout.deleteMany({
    where: { program: { name: { startsWith: "Template Premium Teste" } } },
  });
  await prisma.workoutProgram.deleteMany({
    where: { name: { startsWith: "Template Premium Teste" } },
  });

  const reg = async (email: string, role: string) =>
    (await supertest(server.server).post("/api/auth/register").send({ email, password: pw, role })).body
      .user.id;

  // ADMIN não tem auto-cadastro (mesmo padrão de admin-self-templates.test.ts).
  await prisma.user.create({
    data: {
      email: "aluno_premium_admin@thunderafit.test",
      passwordHash: await bcrypt.hash(pw, 12),
      role: "ADMIN",
    },
  });
  adminToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "aluno_premium_admin@thunderafit.test", password: pw })
  ).body.accessToken;

  await reg("aluno_premium_personal@thunderafit.test", "PERSONAL");
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "aluno_premium_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  alunoId = await reg("aluno_premium_aluno@thunderafit.test", "ALUNO");
  alunoToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "aluno_premium_aluno@thunderafit.test", password: pw })
  ).body.accessToken;
});

afterAll(async () => {
  // A2 (auditoria 2026-08-06): o template do fixture agora tem sessão (exigida
  // pra ser aplicável), e `Workout.programId` NÃO tem cascade — apagar o
  // programa direto viola a FK. Apaga as sessões primeiro.
  await prisma.workout.deleteMany({
    where: { program: { name: { startsWith: "Template Premium Teste" } } },
  });
  await prisma.workoutProgram.deleteMany({
    where: { name: { startsWith: "Template Premium Teste" } },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "aluno_premium_admin@thunderafit.test",
          "aluno_premium_personal@thunderafit.test",
          "aluno_premium_aluno@thunderafit.test",
        ],
      },
    },
  });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 56 — Aluno Premium: status e teste grátis", () => {
  it("PERSONAL não pode acessar o status Premium do aluno (403)", async () => {
    const r = await supertest(server.server)
      .get("/api/billing/aluno/premium-status")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(403);
  });

  it("ALUNO sem nenhuma interação: status NONE, sem acesso, teste disponível", async () => {
    const r = await supertest(server.server)
      .get("/api/billing/aluno/premium-status")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("NONE");
    expect(r.body.hasAccess).toBe(false);
    expect(r.body.trialAvailable).toBe(true);
  });

  it("PERSONAL não pode iniciar o teste grátis do aluno (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/aluno/trial")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(403);
  });

  it("ALUNO inicia o teste grátis — status TRIAL, acesso concedido por ~7 dias", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/aluno/trial")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("TRIAL");
    expect(r.body.hasAccess).toBe(true);
    expect(r.body.trialAvailable).toBe(false);
    const daysLeft = (new Date(r.body.premiumExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysLeft).toBeGreaterThan(6.9);
    expect(daysLeft).toBeLessThanOrEqual(7);
  });

  it("ALUNO não pode iniciar o teste de novo (já usado — 409)", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/aluno/trial")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(409);
  });
});

describe("Fase 56 — gate real de PREMIUM ao aplicar um template SELF", () => {
  let premiumTemplateId: string;

  beforeAll(async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template Premium Teste Gate", sessionScheme: "LETTER", category: "PREMIUM" });
    premiumTemplateId = created.body.program.id;

    // A2 (auditoria 2026-08-06): o template precisa ter ao menos 1 sessão pra
    // ser aplicável — `applySelfTemplate` agora recusa template vazio com 409
    // (um template sem sessão substituiria o treino real do aluno por um
    // programa vazio, apagando o histórico de séries). Antes desta linha o
    // fixture criava um template sem sessão nenhuma, o que não representa um
    // template curado de verdade.
    await supertest(server.server)
      .post(`/api/admin/self-templates/${premiumTemplateId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Sessão A", letter: "A" });
  });

  it("ALUNO sem acesso Premium não consegue aplicar um template PREMIUM (402, code PREMIUM_REQUIRED)", async () => {
    // Este aluno já usou o trial no describe anterior mas o trial expira em
    // ~7 dias reais — pra testar o caminho "sem acesso" isoladamente, usa um
    // aluno novo, nunca tocado.
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "aluno_premium_semtrial@thunderafit.test", password: pw, role: "ALUNO" });
    const semTrialToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "aluno_premium_semtrial@thunderafit.test", password: pw })
    ).body.accessToken;

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${premiumTemplateId}/apply-self-template`)
      .set("Authorization", `Bearer ${semTrialToken}`);
    expect(r.status).toBe(402);
    expect(r.body.code).toBe("PREMIUM_REQUIRED");

    await prisma.user.delete({ where: { email: "aluno_premium_semtrial@thunderafit.test" } });
  });

  it("ALUNO com trial ativo consegue aplicar um template PREMIUM", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${premiumTemplateId}/apply-self-template`)
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(201);
    expect(r.body.program.name).toBe("Template Premium Teste Gate");
  });
});
