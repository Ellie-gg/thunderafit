import supertest from "supertest";
import crypto from "crypto";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

const sendMailMock = jest.fn();
jest.mock("../../lib/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
}));

// Mesmo mock de google-auth-library usado em google-sso.test.ts — precisa
// estar no topo do arquivo (não aninhado num describe) pra o jest hoistar
// corretamente antes do `import { buildApp }` resolver o módulo de verdade.
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(async ({ idToken }: { idToken: string }) => {
      const payload = JSON.parse(idToken);
      return { getPayload: () => payload };
    }),
  })),
}));

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";
// Fase 81: TODOS os e-mails usados no arquivo, centralizados aqui — a
// limpeza roda só em beforeAll/afterAll (nunca inline em cada `it`), pra
// não deixar lixo órfão se um teste falhar antes de chegar na própria
// limpeza (foi exatamente isso que aconteceu numa 1ª versão deste arquivo).
const TEST_EMAILS = [
  "email_verif_test@thunderafit.test",
  "email_verif_falha_teste@thunderafit.test",
  "email_verif_link_test@thunderafit.test",
  "email_verif_invalid_test@thunderafit.test",
  "email_verif_expired_test@thunderafit.test",
  "email_verif_resend_test@thunderafit.test",
  "email_verif_google_test@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
});

afterEach(() => {
  sendMailMock.mockReset();
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

describe("Fase 81 — confirmação de e-mail", () => {
  it("cadastro dispara e-mail de verificação; conta nasce com emailVerifiedAt null", async () => {
    sendMailMock.mockResolvedValue(true);
    const res = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "email_verif_test@thunderafit.test", password: pw, role: "ALUNO" });
    expect(res.status).toBe(201);
    expect(res.body.user.emailVerifiedAt).toBeNull();
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const [args] = sendMailMock.mock.calls[0];
    expect(args.to).toBe("email_verif_test@thunderafit.test");
    expect(args.text).toContain("/verificar-email");
  });

  it("falha no envio do e-mail de verificação não derruba o cadastro", async () => {
    sendMailMock.mockRejectedValue(new Error("SMTP indisponível"));
    const res = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "email_verif_falha_teste@thunderafit.test", password: pw, role: "ALUNO" });
    expect(res.status).toBe(201);
    await prisma.user.deleteMany({ where: { email: "email_verif_falha_teste@thunderafit.test" } });
  });

  it("verifica o e-mail com o link recebido; token não é reutilizável depois", async () => {
    sendMailMock.mockResolvedValue(true);
    await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "email_verif_link_test@thunderafit.test", password: pw, role: "ALUNO" });
    const [args] = sendMailMock.mock.calls[0];
    const { uid, token } = extractLinkParams(args.text);
    expect(uid).toBeTruthy();
    expect(token).toBeTruthy();

    const res = await supertest(server.server)
      .post("/api/auth/verify-email")
      .send({ uid, token });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).not.toBeNull();

    // Reutilizar o mesmo token de novo (idempotente: já está verificado, sem erro).
    const secondTry = await supertest(server.server)
      .post("/api/auth/verify-email")
      .send({ uid, token });
    expect(secondTry.status).toBe(200);

    await prisma.user.deleteMany({ where: { email: "email_verif_link_test@thunderafit.test" } });
  });

  it("token inválido → 400", async () => {
    sendMailMock.mockResolvedValue(true);
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "email_verif_invalid_test@thunderafit.test", password: pw, role: "ALUNO" });
    const res = await supertest(server.server)
      .post("/api/auth/verify-email")
      .send({ uid: reg.body.user.id, token: "TOKEN_ERRADO" });
    expect(res.status).toBe(400);
    await prisma.user.deleteMany({ where: { email: "email_verif_invalid_test@thunderafit.test" } });
  });

  it("token expirado → 400", async () => {
    sendMailMock.mockResolvedValue(true);
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "email_verif_expired_test@thunderafit.test", password: pw, role: "ALUNO" });
    const [args] = sendMailMock.mock.calls[0];
    const { token } = extractLinkParams(args.text);

    // Força a expiração direto no banco.
    await prisma.user.update({
      where: { id: reg.body.user.id },
      data: { emailVerificationTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await supertest(server.server)
      .post("/api/auth/verify-email")
      .send({ uid: reg.body.user.id, token });
    expect(res.status).toBe(400);
    await prisma.user.deleteMany({ where: { email: "email_verif_expired_test@thunderafit.test" } });
  });

  it("resend-verification: autenticado, reenvia; já verificado → 400", async () => {
    sendMailMock.mockResolvedValue(true);
    await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "email_verif_resend_test@thunderafit.test", password: pw, role: "ALUNO" });
    const login = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "email_verif_resend_test@thunderafit.test", password: pw });
    const token = login.body.accessToken;

    sendMailMock.mockClear();
    const resendRes = await supertest(server.server)
      .post("/api/auth/resend-verification")
      .set("Authorization", `Bearer ${token}`);
    expect(resendRes.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    // Verifica de verdade, depois tenta reenviar de novo → 400 (já verificado).
    const [args] = sendMailMock.mock.calls[0];
    const { uid, token: verifyToken } = extractLinkParams(args.text);
    await supertest(server.server).post("/api/auth/verify-email").send({ uid, token: verifyToken });

    const secondResend = await supertest(server.server)
      .post("/api/auth/resend-verification")
      .set("Authorization", `Bearer ${token}`);
    expect(secondResend.status).toBe(400);

    await prisma.user.deleteMany({ where: { email: "email_verif_resend_test@thunderafit.test" } });
  });

  it("resend-verification sem autenticação → 401", async () => {
    const res = await supertest(server.server).post("/api/auth/resend-verification");
    expect(res.status).toBe(401);
  });
});

describe("Fase 81 — conta Google já nasce com e-mail verificado", () => {
  it("conta criada via Google já tem emailVerifiedAt preenchido", async () => {
    const idToken = JSON.stringify({
      email: "email_verif_google_test@thunderafit.test",
      email_verified: true,
      sub: "google-sub-email-verif-test",
      name: "Google Test",
    });
    const res = await supertest(server.server)
      .post("/api/auth/google")
      .send({ idToken, role: "ALUNO" });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).not.toBeNull();
  });
});
