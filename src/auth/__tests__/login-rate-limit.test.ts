import supertest from "supertest";
import { buildApp } from "../../app";
import { _resetForTests } from "../services/login-rate-limiter";

let server: import("fastify").FastifyInstance;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  _resetForTests();
});

describe("Fase 14 — rate limiting de login (tentativas falhas consecutivas)", () => {
  // E-mail nunca cadastrado de propósito: o rate limiter conta a tentativa
  // ANTES de checar se a conta existe, então não precisa de um usuário real
  // para provar o bloqueio.
  const email = "ratelimit_nao_existe@thunderafit.test";

  it("permite as 4 primeiras tentativas com credenciais erradas (401, não 429)", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await supertest(server.server)
        .post("/api/auth/login")
        .send({ email, password: "senha_errada" });
      expect(r.status).toBe(401);
    }
  });

  it("bloqueia com 429 a partir da 6ª tentativa (a 5ª falha ainda responde 401, mas já arma o bloqueio para a próxima)", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await supertest(server.server)
        .post("/api/auth/login")
        .send({ email, password: "senha_errada" });
      expect(r.status).toBe(401);
    }

    const sixth = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email, password: "senha_errada" });
    expect(sixth.status).toBe(429);
    expect(sixth.body.error).toMatch(/Muitas tentativas/);

    // Mesmo com a senha CERTA agora, continua bloqueado até o tempo passar —
    // é bloqueio por IP+email, não só "senha errada".
    const seventh = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email, password: "qualquer_coisa" });
    expect(seventh.status).toBe(429);
  });

  it("login bem-sucedido reseta o contador de falhas", async () => {
    const adminEmail = "ratelimit_reset_admin@thunderafit.test";
    const prisma = (await import("../../lib/prisma")).default;
    const bcrypt = (await import("bcrypt")).default;
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
        role: "ADMIN",
      },
    });

    // 3 tentativas falhas (abaixo do teto de 5)
    for (let i = 0; i < 3; i++) {
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "senha_errada" });
    }

    // Login correto — deve funcionar (ainda não bateu o teto) e resetar o contador
    const ok = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: adminEmail, password: "SenhaSegura@123" });
    expect(ok.status).toBe(200);

    // Mais 4 tentativas falhas — se o contador não tivesse resetado, isso já
    // teria estourado o teto acumulado (3 + 4 = 7 > 5). Como resetou, ainda
    // não bloqueia.
    for (let i = 0; i < 4; i++) {
      const r = await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "senha_errada" });
      expect(r.status).toBe(401);
    }

    await prisma.user.delete({ where: { email: adminEmail } });
  });
});
