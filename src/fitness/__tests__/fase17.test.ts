import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

// Cobre os itens da Fase 17 que tocaram o backend:
//  - Item 4: role gate em GET /api/users/lookup e POST /api/workouts.
//  - Item 5: DietPlan.isActive — criar novo plano desativa o anterior.
//  - Item 6: Nutricionista lê anamnese do aluno vinculado; aluno abre dúvida
//    com o Nutricionista e o Nutricionista responde como profissional.

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";

let personalToken: string;
let nutriToken: string;
let nutriId: string;
let alunoToken: string;
let alunoId: string;
let outroAlunoId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const reg = async (email: string, role: string) =>
    (await supertest(server.server).post("/api/auth/register").send({ email, password: pw, role })).body.user.id;
  const login = async (email: string) =>
    (await supertest(server.server).post("/api/auth/login").send({ email, password: pw })).body.accessToken;

  await reg("f17_personal@thunderafit.test", "PERSONAL");
  nutriId = await reg("f17_nutri@thunderafit.test", "NUTRICIONISTA");
  alunoId = await reg("f17_aluno@thunderafit.test", "ALUNO");
  outroAlunoId = await reg("f17_outro@thunderafit.test", "ALUNO");

  personalToken = await login("f17_personal@thunderafit.test");
  nutriToken = await login("f17_nutri@thunderafit.test");
  alunoToken = await login("f17_aluno@thunderafit.test");

  // Vincula o aluno ao Personal e ao Nutricionista (mas NÃO o outroAluno ao nutri).
  await supertest(server.server).post("/api/relations").set("Authorization", `Bearer ${personalToken}`).send({ alunoId });
  await supertest(server.server).post("/api/relations").set("Authorization", `Bearer ${nutriToken}`).send({ alunoId });
});

afterAll(async () => {
  const ids = [alunoId, outroAlunoId, nutriId];
  await prisma.supportMessage.deleteMany({});
  await prisma.supportThread.deleteMany({ where: { alunoId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.anamnesis.deleteMany({ where: { alunoId: { in: ids } } });
  const plans = await prisma.dietPlan.findMany({ where: { alunoId: { in: ids } }, select: { id: true } });
  await prisma.dietFood.deleteMany({ where: { dietMeal: { dietPlanId: { in: plans.map((p) => p.id) } } } });
  await prisma.dietMeal.deleteMany({ where: { dietPlanId: { in: plans.map((p) => p.id) } } });
  await prisma.dietPlan.deleteMany({ where: { alunoId: { in: ids } } });
  await prisma.clientRelation.deleteMany({ where: { alunoId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { contains: "f17_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("Fase 17 Item 4 — role gate (auditoria)", () => {
  it("GET /api/users/lookup como ALUNO retorna 403 (antes vazava enumeração)", async () => {
    const r = await supertest(server.server)
      .get("/api/users/lookup?email=f17_outro@thunderafit.test")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(403);
  });

  it("GET /api/users/lookup como PERSONAL continua funcionando (200)", async () => {
    const r = await supertest(server.server)
      .get("/api/users/lookup?email=f17_outro@thunderafit.test")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.user.id).toBe(outroAlunoId);
  });

  it("POST /api/workouts como NUTRICIONISTA retorna 403 (treino é domínio do Personal)", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId, name: "Treino do nutri (não deveria)", letter: "A" });
    expect(r.status).toBe(403);
  });

  it("POST /api/workouts como PERSONAL continua funcionando (201)", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId, name: "Treino do personal", letter: "A" });
    expect(r.status).toBe(201);
  });
});

describe("Fase 17 Item 5 — DietPlan.isActive (um plano ativo por vez)", () => {
  it("criar um 2º plano para o aluno desativa o 1º", async () => {
    const p1 = await supertest(server.server)
      .post("/api/diet-plans")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId, name: "Dieta Antiga" });
    expect(p1.status).toBe(201);
    expect(p1.body.plan.isActive).toBe(true);

    const p2 = await supertest(server.server)
      .post("/api/diet-plans")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId, name: "Dieta Nova" });
    expect(p2.status).toBe(201);
    expect(p2.body.plan.isActive).toBe(true);

    // Só um plano ativo, e é o mais novo.
    const ativos = await prisma.dietPlan.findMany({ where: { alunoId, isActive: true } });
    expect(ativos).toHaveLength(1);
    expect(ativos[0].id).toBe(p2.body.plan.id);
    expect(ativos[0].name).toBe("Dieta Nova");
  });
});

describe("Fase 17 Item 6 — anamnese e dúvidas simétricas ao Nutricionista", () => {
  beforeAll(async () => {
    // Aluno preenche a anamnese.
    await supertest(server.server)
      .post("/api/anamnesis")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ fullName: "Aluno F17", heightCm: 180, weightKg: 80, goals: "Hipertrofia" });
  });

  it("Nutricionista vinculado lê (somente leitura) a anamnese do aluno", async () => {
    const r = await supertest(server.server)
      .get(`/api/anamnesis?alunoId=${alunoId}`)
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(r.status).toBe(200);
    expect(r.body.anamnesis.fullName).toBe("Aluno F17");
  });

  it("Nutricionista NÃO vinculado ao aluno recebe 403 na anamnese", async () => {
    // nutri não está vinculado ao outroAluno; mas outroAluno precisa ter anamnese p/ testar o gate — o 403 vem do vínculo, antes de checar existência
    const r = await supertest(server.server)
      .get(`/api/anamnesis?alunoId=${outroAlunoId}`)
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(r.status).toBe(403);
  });

  it("my-personals do aluno inclui Personal E Nutricionista, com professionalType", async () => {
    const r = await supertest(server.server)
      .get("/api/support/my-personals")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    const types = r.body.personals.map((p: any) => p.professionalType).sort();
    expect(types).toEqual(["NUTRICIONISTA", "PERSONAL"]);
  });

  it("aluno abre dúvida com o Nutricionista e o Nutricionista responde → RESPONDIDO + notifica aluno", async () => {
    const created = await supertest(server.server)
      .post("/api/support/threads")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ personalId: nutriId, subject: "Dúvida de dieta", message: "Posso trocar arroz por batata?" });
    expect(created.status).toBe(201);
    const threadId = created.body.thread.id;

    // Nutricionista vê a thread na sua lista.
    const inbox = await supertest(server.server)
      .get("/api/support/threads")
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(inbox.body.threads.some((t: any) => t.id === threadId)).toBe(true);

    // Nutricionista responde.
    const reply = await supertest(server.server)
      .post(`/api/support/threads/${threadId}/messages`)
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ text: "Pode sim, mesma porção de carboidrato." });
    expect(reply.status).toBe(201);

    // Thread marcada como RESPONDIDO (nutri tratado como profissional, não como aluno reabrindo).
    const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
    expect(thread?.status).toBe("RESPONDIDO");

    // Aluno foi notificado da resposta.
    const notifs = await prisma.notification.findMany({ where: { userId: alunoId, type: "support_reply" } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });
});
