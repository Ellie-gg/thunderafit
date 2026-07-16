import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let alunoId: string;
let tokenAluno: string;
let notificationId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regAluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_notif_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  alunoId = regAluno.body.user.id;

  const loginAluno = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_notif_aluno@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno = loginAluno.body.accessToken;

  // Cria 2 notificações direto no banco (sem depender do módulo support).
  const n1 = await prisma.notification.create({
    data: { userId: alunoId, type: "test_event", message: "Primeira notificação" },
  });
  notificationId = n1.id;
  await prisma.notification.create({
    data: { userId: alunoId, type: "test_event", message: "Segunda notificação" },
  });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: alunoId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_notif_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("GET /api/notifications", () => {
  it("lista as notificações do usuário autenticado", async () => {
    const r = await supertest(server.server)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.notifications).toHaveLength(2);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("conta 2 não lidas inicialmente", async () => {
    const r = await supertest(server.server)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(2);
  });
});

describe("POST /api/notifications/:id/read", () => {
  it("marca uma notificação como lida", async () => {
    const r = await supertest(server.server)
      .post(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.notification.read).toBe(true);

    const countRes = await supertest(server.server)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(countRes.body.count).toBe(1);
  });

  it("retorna 404 para notificação de outro usuário ou inexistente", async () => {
    const r = await supertest(server.server)
      .post(`/api/notifications/00000000-0000-0000-0000-000000000000/read`)
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(404);
  });
});

describe("POST /api/notifications/read-all", () => {
  it("marca todas como lidas", async () => {
    const r = await supertest(server.server)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);

    const countRes = await supertest(server.server)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(countRes.body.count).toBe(0);
  });
});
