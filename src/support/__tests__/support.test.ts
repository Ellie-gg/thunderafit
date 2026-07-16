import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalId: string;
let outsiderPersonalId: string;
let alunoId: string;
let tokenPersonal: string;
let tokenOutsiderPersonal: string;
let tokenAluno: string;
let threadId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_support_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;

  const regOutsider = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_support_outsider@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  outsiderPersonalId = regOutsider.body.user.id;

  const regAluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_support_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  alunoId = regAluno.body.user.id;

  const loginPersonal = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_support_personal@thunderafit.test", password: "SenhaSegura@123" });
  tokenPersonal = loginPersonal.body.accessToken;

  const loginOutsider = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_support_outsider@thunderafit.test", password: "SenhaSegura@123" });
  tokenOutsiderPersonal = loginOutsider.body.accessToken;

  const loginAluno = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_support_aluno@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno = loginAluno.body.accessToken;

  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId });
});

afterAll(async () => {
  await prisma.supportMessage.deleteMany({ where: { thread: { alunoId } } });
  await prisma.supportThread.deleteMany({ where: { alunoId } });
  await prisma.notification.deleteMany({ where: { userId: { in: [personalId, alunoId] } } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_support_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("GET /api/support/my-personals", () => {
  it("aluno vê o Personal vinculado", async () => {
    const r = await supertest(server.server)
      .get("/api/support/my-personals")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.personals).toHaveLength(1);
    expect(r.body.personals[0].id).toBe(personalId);
  });
});

describe("POST /api/support/threads", () => {
  it("aluno cria uma dúvida com 201 e notifica o Personal", async () => {
    const r = await supertest(server.server)
      .post("/api/support/threads")
      .set("Authorization", `Bearer ${tokenAluno}`)
      .send({ personalId, subject: "Dor no ombro", message: "Sinto dor ao fazer supino, é normal?" });
    expect(r.status).toBe(201);
    expect(r.body.thread.status).toBe("ABERTO");
    threadId = r.body.thread.id;

    const notifRes = await supertest(server.server)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(notifRes.body.notifications.some((n: any) => n.type === "support_new_thread")).toBe(true);
  });

  it("retorna 403 ao tentar criar dúvida para um Personal não vinculado", async () => {
    const r = await supertest(server.server)
      .post("/api/support/threads")
      .set("Authorization", `Bearer ${tokenAluno}`)
      .send({ personalId: outsiderPersonalId, subject: "x", message: "y" });
    expect(r.status).toBe(403);
  });
});

describe("GET /api/support/threads", () => {
  it("aluno vê a própria thread na lista", async () => {
    const r = await supertest(server.server)
      .get("/api/support/threads")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.threads.some((t: any) => t.id === threadId)).toBe(true);
  });

  it("Personal vinculado vê a thread na lista", async () => {
    const r = await supertest(server.server)
      .get("/api/support/threads")
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(200);
    expect(r.body.threads.some((t: any) => t.id === threadId)).toBe(true);
  });

  it("Personal de fora não vê a thread", async () => {
    const r = await supertest(server.server)
      .get("/api/support/threads")
      .set("Authorization", `Bearer ${tokenOutsiderPersonal}`);
    expect(r.status).toBe(200);
    expect(r.body.threads.some((t: any) => t.id === threadId)).toBe(false);
  });
});

describe("POST /api/support/threads/:id/messages", () => {
  it("Personal responde, thread vira RESPONDIDO e aluno é notificado", async () => {
    const r = await supertest(server.server)
      .post(`/api/support/threads/${threadId}/messages`)
      .set("Authorization", `Bearer ${tokenPersonal}`)
      .send({ text: "Sim, ajuste a pegada e reduza a carga." });
    expect(r.status).toBe(201);

    const threadRes = await supertest(server.server)
      .get(`/api/support/threads/${threadId}`)
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(threadRes.body.thread.status).toBe("RESPONDIDO");
    expect(threadRes.body.thread.messages).toHaveLength(2);

    const notifRes = await supertest(server.server)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(notifRes.body.notifications.some((n: any) => n.type === "support_reply")).toBe(true);
  });

  it("usuário de fora recebe 403 ao tentar responder", async () => {
    const r = await supertest(server.server)
      .post(`/api/support/threads/${threadId}/messages`)
      .set("Authorization", `Bearer ${tokenOutsiderPersonal}`)
      .send({ text: "intrometido" });
    expect(r.status).toBe(403);
  });

  it("aluno reabre com nova mensagem: thread volta a ABERTO", async () => {
    const r = await supertest(server.server)
      .post(`/api/support/threads/${threadId}/messages`)
      .set("Authorization", `Bearer ${tokenAluno}`)
      .send({ text: "Ainda sinto um pouco de dor, o que mais eu faço?" });
    expect(r.status).toBe(201);

    const threadRes = await supertest(server.server)
      .get(`/api/support/threads/${threadId}`)
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(threadRes.body.thread.status).toBe("ABERTO");
  });
});
