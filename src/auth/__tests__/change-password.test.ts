import supertest from "supertest";
import jwt from "jsonwebtoken";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";

const TEST_EMAILS = ["change_pw_test@thunderafit.test", "change_pw_test_google@thunderafit.test"];

let token: string;
let userId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  const reg = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "change_pw_test@thunderafit.test", password: pw, role: "ALUNO" });
  userId = reg.body.user.id;
  const login = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "change_pw_test@thunderafit.test", password: pw });
  token = login.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 80 — PUT /api/auth/me/password", () => {
  it("sem autenticação → 401", async () => {
    const res = await supertest(server.server).put("/api/auth/me/password").send({ newPassword: "NovaSenha@456" });
    expect(res.status).toBe(401);
  });

  it("sem newPassword → 400", async () => {
    const res = await supertest(server.server)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: pw });
    expect(res.status).toBe(400);
  });

  it("conta com senha: sem currentPassword → 400", async () => {
    const res = await supertest(server.server)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NovaSenha@456" });
    expect(res.status).toBe(400);
  });

  it("conta com senha: currentPassword errada → 401", async () => {
    const res = await supertest(server.server)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "SenhaErrada@000", newPassword: "NovaSenha@456" });
    expect(res.status).toBe(401);
  });

  it("nova senha curta demais → 400", async () => {
    const res = await supertest(server.server)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: pw, newPassword: "curta" });
    expect(res.status).toBe(400);
  });

  it("troca com sucesso: nova senha loga, senha antiga deixa de funcionar", async () => {
    const res = await supertest(server.server)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: pw, newPassword: "NovaSenha@456" });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.passwordHash).toBeUndefined();

    const oldLogin = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "change_pw_test@thunderafit.test", password: pw });
    expect(oldLogin.status).toBe(401);

    const newLogin = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "change_pw_test@thunderafit.test", password: "NovaSenha@456" });
    expect(newLogin.status).toBe(200);
  });

  it("conta só-Google (sem senha) define a senha pela 1ª vez sem currentPassword", async () => {
    const googleUser = await prisma.user.create({
      data: {
        email: "change_pw_test_google@thunderafit.test",
        passwordHash: null,
        googleId: "fake-google-sub-change-pw-test",
        role: "ALUNO",
      },
    });
    // Login tradicional não se aplica (sem senha) — gera um token direto
    // pelo mesmo helper que a rota de login usaria, simulando uma sessão já
    // autenticada via Google.
    const accessToken = jwt.sign(
      { sub: googleUser.id, email: googleUser.email, role: googleUser.role },
      process.env.JWT_SECRET as string
    );

    const res = await supertest(server.server)
      .put("/api/auth/me/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ newPassword: "PrimeiraSenha@789" });
    expect(res.status).toBe(200);

    const loginRes = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "change_pw_test_google@thunderafit.test", password: "PrimeiraSenha@789" });
    expect(loginRes.status).toBe(200);
  });
});
