import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import * as loginRateLimiter from "../services/login-rate-limiter";

const sendMailMock = jest.fn();
jest.mock("../../lib/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
}));

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";
const TEST_EMAILS = [
  "pwreset_generic_test@thunderafit.test",
  "pwreset_happy_test@thunderafit.test",
  "pwreset_invalid_test@thunderafit.test",
  "pwreset_expired_test@thunderafit.test",
  "pwreset_short_test@thunderafit.test",
  "pwreset_ratelimit_test@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
});

afterEach(() => {
  sendMailMock.mockReset();
  loginRateLimiter._resetForTests();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

function extractLinkParams(text: string) {
  const match = text.match(/uid=([^&\s]+)&token=([^\s]+)/);
  return { uid: match?.[1], token: match?.[2] };
}

describe("Fase 81 — esqueci minha senha", () => {
  it("resposta genérica é idêntica para e-mail existente e inexistente", async () => {
    sendMailMock.mockResolvedValue(true);
    await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "pwreset_generic_test@thunderafit.test", password: pw, role: "ALUNO" });
    sendMailMock.mockReset();

    const existing = await supertest(server.server)
      .post("/api/auth/forgot-password")
      .send({ email: "pwreset_generic_test@thunderafit.test" });
    const missing = await supertest(server.server)
      .post("/api/auth/forgot-password")
      .send({ email: "no_such_account_at_all@thunderafit.test" });

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body.message).toBe(missing.body.message);
    // Só a conta existente dispara e-mail de verdade.
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("redefine a senha com o link recebido; sessões existentes são invalidadas", async () => {
    sendMailMock.mockResolvedValue(true);
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "pwreset_happy_test@thunderafit.test", password: pw, role: "ALUNO" });
    const uid = reg.body.user.id;

    const login1 = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "pwreset_happy_test@thunderafit.test", password: pw });
    expect(login1.status).toBe(200);
    const oldRefreshToken = login1.body.refreshToken;

    sendMailMock.mockClear();
    const forgot = await supertest(server.server)
      .post("/api/auth/forgot-password")
      .send({ email: "pwreset_happy_test@thunderafit.test" });
    expect(forgot.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const [args] = sendMailMock.mock.calls[0];
    const { token } = extractLinkParams(args.text);

    const newPassword = "OutraSenhaSegura@456";
    const reset = await supertest(server.server)
      .post("/api/auth/reset-password")
      .send({ uid, token, newPassword });
    expect(reset.status).toBe(200);

    // Verifica a invalidação de sessão ANTES de logar de novo — um novo login
    // no mesmo segundo poderia gerar um JWT byte-idêntico ao antigo (mesmo
    // payload + mesmo `iat` truncado a segundos), mascarando o teste.
    const refreshWithOldToken = await supertest(server.server)
      .post("/api/auth/refresh")
      .send({ refreshToken: oldRefreshToken });
    expect(refreshWithOldToken.status).toBe(401);

    const oldPasswordLogin = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "pwreset_happy_test@thunderafit.test", password: pw });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "pwreset_happy_test@thunderafit.test", password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
  });

  it("token inválido → 400", async () => {
    sendMailMock.mockResolvedValue(true);
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "pwreset_invalid_test@thunderafit.test", password: pw, role: "ALUNO" });
    const res = await supertest(server.server)
      .post("/api/auth/reset-password")
      .send({ uid: reg.body.user.id, token: "TOKEN_ERRADO", newPassword: "OutraSenha@789" });
    expect(res.status).toBe(400);
  });

  it("token expirado → 400", async () => {
    sendMailMock.mockResolvedValue(true);
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "pwreset_expired_test@thunderafit.test", password: pw, role: "ALUNO" });
    sendMailMock.mockClear();
    await supertest(server.server)
      .post("/api/auth/forgot-password")
      .send({ email: "pwreset_expired_test@thunderafit.test" });
    const [args] = sendMailMock.mock.calls[0];
    const { token } = extractLinkParams(args.text);

    await prisma.user.update({
      where: { id: reg.body.user.id },
      data: { passwordResetTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await supertest(server.server)
      .post("/api/auth/reset-password")
      .send({ uid: reg.body.user.id, token, newPassword: "OutraSenha@789" });
    expect(res.status).toBe(400);
  });

  it("nova senha curta demais → 400", async () => {
    sendMailMock.mockResolvedValue(true);
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "pwreset_short_test@thunderafit.test", password: pw, role: "ALUNO" });
    sendMailMock.mockClear();
    await supertest(server.server)
      .post("/api/auth/forgot-password")
      .send({ email: "pwreset_short_test@thunderafit.test" });
    const [args] = sendMailMock.mock.calls[0];
    const { token } = extractLinkParams(args.text);

    const res = await supertest(server.server)
      .post("/api/auth/reset-password")
      .send({ uid: reg.body.user.id, token, newPassword: "curta" });
    expect(res.status).toBe(400);
  });

  it("forgot-password é rate-limitado após tentativas repetidas", async () => {
    const email = "pwreset_ratelimit_test@thunderafit.test";
    let lastRes;
    for (let i = 0; i < 6; i++) {
      lastRes = await supertest(server.server).post("/api/auth/forgot-password").send({ email });
    }
    expect(lastRes!.status).toBe(429);
  });
});
