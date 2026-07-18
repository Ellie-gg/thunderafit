import supertest from "supertest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import { _resetForTests } from "../services/login-rate-limiter";

let app: FastifyInstance;

const EXISTING_EMAIL = "test_check_email_existente@thunderafit.test";

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  await prisma.user.deleteMany({ where: { email: EXISTING_EMAIL } });
  await prisma.user.create({
    data: {
      email: EXISTING_EMAIL,
      passwordHash: "hash-nao-usado-neste-teste",
      role: "ALUNO",
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EXISTING_EMAIL } });
  await app.close();
  await prisma.$disconnect();
});

beforeEach(() => {
  _resetForTests();
});

describe("POST /api/auth/check-email", () => {
  it("retorna { exists: true } e SOMENTE isso para e-mail cadastrado", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/check-email")
      .send({ email: EXISTING_EMAIL });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ exists: true });
    expect(response.body.role).toBeUndefined();
    expect(response.body.user).toBeUndefined();
    expect(response.body.id).toBeUndefined();
  });

  it("retorna { exists: false } para e-mail não cadastrado", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/check-email")
      .send({ email: "test_check_email_inexistente@thunderafit.test" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ exists: false });
  });

  it("retorna 400 para e-mail ausente", async () => {
    const response = await supertest(app.server).post("/api/auth/check-email").send({});
    expect(response.status).toBe(400);
  });

  it("retorna 400 para e-mail com formato inválido", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/check-email")
      .send({ email: "nao-e-um-email" });
    expect(response.status).toBe(400);
  });

  it("bloqueia com 429 após 5 chamadas do mesmo IP (reaproveita o rate limiter da Fase 14)", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await supertest(app.server)
        .post("/api/auth/check-email")
        .send({ email: EXISTING_EMAIL });
      expect(r.status).toBe(200);
    }

    const sixth = await supertest(app.server)
      .post("/api/auth/check-email")
      .send({ email: EXISTING_EMAIL });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error).toMatch(/Muitas verificações/);
  });
});
