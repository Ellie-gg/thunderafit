import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;

let adminToken: string;
let adminId: string;
let personalId: string;
let personalToken: string;
let nutriId: string;
let alunoIds: string[] = [];
let alunoTokens: string[] = [];
let threadId: string;
let workoutId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  // ADMIN não tem auto-cadastro (bloqueado em POST /api/auth/register) —
  // criado direto via prisma, mesmo padrão do script prisma/seed-admin.ts.
  const admin = await prisma.user.create({
    data: {
      email: "admin_test_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  const adminLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_test_root@thunderafit.test", password: "SenhaSegura@123" });
  adminToken = adminLogin.body.accessToken;

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_test_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;
  const personalLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_test_personal@thunderafit.test", password: "SenhaSegura@123" });
  personalToken = personalLogin.body.accessToken;

  const regNutri = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_test_nutri@thunderafit.test", password: "SenhaSegura@123", role: "NUTRICIONISTA" });
  nutriId = regNutri.body.user.id;

  // 4 alunos: 1,2,3 vinculados ao Personal (3/3 = no limite Freemium); 4 órfão (sem nenhum vínculo).
  for (let i = 0; i < 4; i++) {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: `admin_test_aluno${i + 1}@thunderafit.test`, password: "SenhaSegura@123", role: "ALUNO" });
    alunoIds.push(reg.body.user.id);
    const login = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: `admin_test_aluno${i + 1}@thunderafit.test`, password: "SenhaSegura@123" });
    alunoTokens.push(login.body.accessToken);
  }

  for (let i = 0; i < 3; i++) {
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[i] });
  }

  // Aluno1 abre uma dúvida com o Personal — fica ABERTO (sem resposta), é o
  // caso que o support-sla deve enxergar.
  const thread = await supertest(server.server)
    .post("/api/support/threads")
    .set("Authorization", `Bearer ${alunoTokens[0]}`)
    .send({ personalId, subject: "admin_test_duvida_sla", message: "Pergunta de teste." });
  threadId = thread.body.thread.id;

  // Aluno1 preenche a anamnese, usada no teste do Bloco 3.
  await supertest(server.server)
    .post("/api/anamnesis")
    .set("Authorization", `Bearer ${alunoTokens[0]}`)
    .send({ fullName: "Aluno Admin Teste", heightCm: 175, weightKg: 70 });

  // Personal cria um treino para o aluno1 — usado nos testes de visão
  // ampliada do ADMIN sobre /api/workouts.
  const workout = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ alunoId: alunoIds[0], name: "Treino A", letter: "A" });
  workoutId = workout.body.workout.id;
});

afterAll(async () => {
  await prisma.adminAccessLog.deleteMany({ where: { adminId } });
  await prisma.loginLog.deleteMany({ where: { userId: { in: [adminId, personalId, nutriId, ...alunoIds] } } });
  await prisma.supportMessage.deleteMany({ where: { threadId } });
  await prisma.supportThread.deleteMany({ where: { id: threadId } });
  await prisma.anamnesis.deleteMany({ where: { alunoId: { in: alunoIds } } });
  await prisma.clientRelation.deleteMany({ where: { personalId: { in: [personalId, nutriId] } } });
  await prisma.user.deleteMany({ where: { email: { contains: "admin_test_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("Fase 14 — acesso restrito: não-admin recebe 403 em todo /api/admin/*", () => {
  const adminPaths = [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/logins",
    "/api/admin/support-sla",
    "/api/admin/access-logs",
  ];

  it.each(adminPaths)("%s com token de Personal retorna 403", async (path) => {
    const r = await supertest(server.server).get(path).set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(403);
  });

  it.each(adminPaths)("%s com token de Aluno retorna 403", async (path) => {
    const r = await supertest(server.server).get(path).set("Authorization", `Bearer ${alunoTokens[0]}`);
    expect(r.status).toBe(403);
  });
});

describe("GET /api/admin/overview", () => {
  it("reflete os 4 alunos e o Personal no limite Freemium criados no setup (delta antes/depois)", async () => {
    // Cálculo manual esperado: 4 novos ALUNO, 1 novo PERSONAL, 1 novo
    // NUTRICIONISTA, 1 novo ADMIN. O Personal está 3/3 (no limite); o
    // Nutricionista está 0/3 (não vinculado a ninguém neste teste) — só o
    // Personal deve contar em professionalsAtFreemiumLimit.
    const r = await supertest(server.server)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(r.status).toBe(200);
    expect(r.body.usersByRole.ALUNO).toBeGreaterThanOrEqual(4);
    expect(r.body.usersByRole.PERSONAL).toBeGreaterThanOrEqual(1);
    expect(r.body.usersByRole.NUTRICIONISTA).toBeGreaterThanOrEqual(1);
    expect(r.body.usersByRole.ADMIN).toBeGreaterThanOrEqual(1);
    expect(r.body.professionalsAtFreemiumLimit).toBeGreaterThanOrEqual(1);
    expect(r.body.totalProfessionals).toBeGreaterThanOrEqual(2);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBucket = r.body.newUsersByDay.find((d: any) => d.day === todayStr);
    // 4 alunos + 1 personal + 1 nutri + 1 admin criados agora mesmo == pelo menos 7 hoje.
    expect(todayBucket).toBeDefined();
    expect(todayBucket.count).toBeGreaterThanOrEqual(7);
  });
});

describe("GET /api/admin/users", () => {
  it("marca isOrphanAluno corretamente: só o aluno4 (sem nenhum vínculo) é órfão", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/users")
      .query({ role: "ALUNO", pageSize: 100 })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(r.status).toBe(200);
    const ours = r.body.users.filter((u: any) => alunoIds.includes(u.id));
    expect(ours).toHaveLength(4);

    const byId = new Map<string, any>(ours.map((u: any) => [u.id, u]));
    expect(byId.get(alunoIds[0]).isOrphanAluno).toBe(false);
    expect(byId.get(alunoIds[1]).isOrphanAluno).toBe(false);
    expect(byId.get(alunoIds[2]).isOrphanAluno).toBe(false);
    expect(byId.get(alunoIds[3]).isOrphanAluno).toBe(true);
  });

  it("lastLoginAt vem preenchido após o login feito no setup", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/users")
      .query({ role: "PERSONAL", pageSize: 100 })
      .set("Authorization", `Bearer ${adminToken}`);
    const personal = r.body.users.find((u: any) => u.id === personalId);
    expect(personal.lastLoginAt).not.toBeNull();
  });
});

describe("GET /api/admin/logins", () => {
  it("inclui o login recente do Personal, com e-mail resolvido", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/logins")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const personalLogin = r.body.logins.find((l: any) => l.userId === personalId);
    expect(personalLogin).toBeDefined();
    expect(personalLogin.email).toBe("admin_test_personal@thunderafit.test");
  });
});

describe("GET /api/admin/support-sla", () => {
  it("lista a dúvida ABERTA criada no setup, com horas em aberto calculadas", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/support-sla")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const thread = r.body.threads.find((t: any) => t.id === threadId);
    expect(thread).toBeDefined();
    expect(thread.alunoId).toBe(alunoIds[0]);
    expect(thread.personalId).toBe(personalId);
    // Acabou de ser criada — deve estar entre 0h e poucos minutos, nunca negativo.
    expect(thread.hoursOpen).toBeGreaterThanOrEqual(0);
    expect(thread.hoursOpen).toBeLessThan(0.1);
  });
});

describe("Fase 14 Bloco 1 — ADMIN com visão ampliada em endpoints hoje restritos ao dono", () => {
  it("GET /api/relations?personalId= como ADMIN vê os 3 vínculos do Personal", async () => {
    const r = await supertest(server.server)
      .get("/api/relations")
      .query({ personalId })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.relations).toHaveLength(3);
  });

  it("GET /api/workouts?personalId= como ADMIN vê o treino criado pelo Personal", async () => {
    const r = await supertest(server.server)
      .get("/api/workouts")
      .query({ personalId })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts.some((w: any) => w.id === workoutId)).toBe(true);
  });

  it("GET /api/workouts/:id como ADMIN acessa o treino sem ser dono nem aluno", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workout.id).toBe(workoutId);
  });

  it("GET /api/support/threads/:id como ADMIN acessa a dúvida sem ser aluno nem Personal", async () => {
    const r = await supertest(server.server)
      .get(`/api/support/threads/${threadId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.thread.id).toBe(threadId);
  });

  it("sem query param, ADMIN não vê nada por engano (retorna vazio, não os dados de outro usuário)", async () => {
    const r = await supertest(server.server)
      .get("/api/relations")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.relations).toHaveLength(0);
  });
});

describe("Fase 14 Bloco 3 — ADMIN acessa anamnese e o acesso fica auditado", () => {
  it("GET /api/anamnesis?alunoId= como ADMIN retorna o conteúdo sem precisar de vínculo", async () => {
    const r = await supertest(server.server)
      .get("/api/anamnesis")
      .query({ alunoId: alunoIds[0] })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.anamnesis.fullName).toBe("Aluno Admin Teste");
  });

  it("o acesso acima gerou uma linha em AdminAccessLog, visível em /api/admin/access-logs", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/access-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const entry = r.body.logs.find(
      (l: any) => l.adminId === adminId && l.alunoId === alunoIds[0] && l.resourceType === "anamnesis"
    );
    expect(entry).toBeDefined();
  });
});
