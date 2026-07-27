import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

// Fase 77 — mocka a verificação do idToken do Google (mesmo padrão de
// jest.mock já usado neste repo pra dependências externas — ver
// admin-exercise-media.test.ts pro storage). O "idToken" nos testes é só um
// JSON.stringify do payload que queremos que o Google "devolva".
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(async ({ idToken }: { idToken: string }) => {
      if (idToken === "TOKEN_INVALIDO") {
        throw new Error("invalid token");
      }
      const payload = JSON.parse(idToken);
      return { getPayload: () => payload };
    }),
  })),
}));

let server: import("fastify").FastifyInstance;

function fakeIdToken(payload: Record<string, unknown>) {
  return JSON.stringify({ email_verified: true, sub: "google-sub-default", ...payload });
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: "gsso_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("Fase 77 — SSO Google (POST /api/auth/google)", () => {
  it("token inválido → 401", async () => {
    const r = await supertest(server.server).post("/api/auth/google").send({ idToken: "TOKEN_INVALIDO" });
    expect(r.status).toBe(401);
  });

  it("sem idToken → 400", async () => {
    const r = await supertest(server.server).post("/api/auth/google").send({});
    expect(r.status).toBe(400);
  });

  it("e-mail não verificado pelo Google → 401", async () => {
    const idToken = fakeIdToken({ email: "gsso_unverified@thunderafit.test", email_verified: false });
    const r = await supertest(server.server).post("/api/auth/google").send({ idToken });
    expect(r.status).toBe(401);
  });

  it("e-mail novo, sem role → needsRole: true, nenhuma conta criada", async () => {
    const email = "gsso_novo@thunderafit.test";
    const idToken = fakeIdToken({ email, sub: "google-sub-novo", name: "Novo Usuário" });
    const r = await supertest(server.server).post("/api/auth/google").send({ idToken });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ needsRole: true, email });

    const created = await prisma.user.findUnique({ where: { email } });
    expect(created).toBeNull();
  });

  it("e-mail novo + role ALUNO → cria conta com passwordHash null, seta cookies", async () => {
    const email = "gsso_aluno@thunderafit.test";
    const idToken = fakeIdToken({ email, sub: "google-sub-aluno", name: "Aluno Google" });
    const r = await supertest(server.server).post("/api/auth/google").send({ idToken, role: "ALUNO" });
    expect(r.status).toBe(200);
    expect(r.body.needsRole).toBe(false);
    expect(r.body.user.email).toBe(email);
    expect(r.body.user.role).toBe("ALUNO");
    expect(r.body.accessToken).toBeTruthy();
    expect(r.headers["set-cookie"]).toBeDefined();

    const created = await prisma.user.findUnique({ where: { email } });
    expect(created?.passwordHash).toBeNull();
    expect(created?.googleId).toBe("google-sub-aluno");
    expect(created?.name).toBe("Aluno Google");
  });

  it("role inválido (ex: ADMIN) numa conta nova → 400", async () => {
    const idToken = fakeIdToken({ email: "gsso_admin_tentativa@thunderafit.test", sub: "google-sub-admin" });
    const r = await supertest(server.server).post("/api/auth/google").send({ idToken, role: "ADMIN" });
    expect(r.status).toBe(400);
  });

  it("e-mail já existente (conta tradicional) → login direto, vincula googleId", async () => {
    const email = "gsso_ja_existe@thunderafit.test";
    await supertest(server.server)
      .post("/api/auth/register")
      .send({ email, password: "SenhaSegura@123", role: "PERSONAL" });

    const idToken = fakeIdToken({ email, sub: "google-sub-vinculo" });
    const r = await supertest(server.server).post("/api/auth/google").send({ idToken });
    expect(r.status).toBe(200);
    expect(r.body.needsRole).toBe(false);
    expect(r.body.user.email).toBe(email);
    expect(r.body.user.role).toBe("PERSONAL"); // role da conta original, não escolhida de novo

    const linked = await prisma.user.findUnique({ where: { email } });
    expect(linked?.googleId).toBe("google-sub-vinculo");
    expect(linked?.passwordHash).not.toBeNull(); // senha original preservada
  });

  it("conta criada só por Google não consegue logar com senha (orienta a usar o Google)", async () => {
    const r = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "gsso_aluno@thunderafit.test", password: "qualquer-coisa" });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/Google/);
  });
});
