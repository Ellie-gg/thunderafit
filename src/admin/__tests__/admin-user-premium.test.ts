import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let adminToken: string;
let adminId: string;
let personalToken: string;
let targetAlunoId: string;
let targetPersonalId: string;
let targetAdminId: string;

const TEST_EMAILS = [
  "admin_premium_test_root@thunderafit.test",
  "admin_premium_test_personal@thunderafit.test",
  "admin_premium_test_aluno@thunderafit.test",
  "admin_premium_test_other_admin@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  const admin = await prisma.user.create({
    data: {
      email: "admin_premium_test_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  adminToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_premium_test_root@thunderafit.test", password: "SenhaSegura@123" })
  ).body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_premium_test_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_premium_test_personal@thunderafit.test", password: "SenhaSegura@123" })
  ).body.accessToken;
  targetPersonalId = (
    await prisma.user.findUnique({ where: { email: "admin_premium_test_personal@thunderafit.test" } })
  )!.id;

  const aluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_premium_test_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  targetAlunoId = aluno.body.user.id;

  const otherAdmin = await prisma.user.create({
    data: {
      email: "admin_premium_test_other_admin@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  targetAdminId = otherAdmin.id;
});

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId } });
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 58 — PUT /api/admin/users/:id/premium", () => {
  it("PERSONAL (não-admin) recebe 403", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/premium`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ active: true });
    expect(res.status).toBe(403);
  });

  it("usuário inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .put("/api/admin/users/00000000-0000-0000-0000-000000000000/premium")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true });
    expect(res.status).toBe(404);
  });

  it("ADMIN alvo não tem conceito de Premium (400)", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAdminId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true });
    expect(res.status).toBe(400);
  });

  it("concede Premium a um ALUNO — status ACTIVE, acesso concedido, entrada em AdminAuditLog", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true });
    expect(res.status).toBe(200);
    expect(res.body.user.alunoPremiumStatus).toBe("ACTIVE");
    expect(new Date(res.body.user.alunoPremiumExpiresAt).getTime()).toBeGreaterThan(Date.now());

    const status = await supertest(server.server)
      .get("/api/billing/aluno/premium-status")
      .set(
        "Authorization",
        `Bearer ${(
          await supertest(server.server)
            .post("/api/auth/login")
            .send({ email: "admin_premium_test_aluno@thunderafit.test", password: "SenhaSegura@123" })
        ).body.accessToken}`
      );
    expect(status.body.hasAccess).toBe(true);

    const logs = await prisma.adminAuditLog.findMany({ where: { adminId, targetUserId: targetAlunoId } });
    expect(logs.some((l) => l.action === "PREMIUM_TOGGLE" && l.details === "concedido (ALUNO)")).toBe(true);
  });

  it("revoga Premium do ALUNO — status volta a NONE, sem acesso", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.user.alunoPremiumStatus).toBe("NONE");
    expect(res.body.user.alunoPremiumExpiresAt).toBeNull();
  });

  it("concede Premium a um PERSONAL — vira PLUS", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetPersonalId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true });
    expect(res.status).toBe(200);
    expect(res.body.user.planoAssinatura).toBe("PLUS");
  });

  it("revoga Premium do PERSONAL — volta a FREE com limite 3", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetPersonalId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.user.planoAssinatura).toBe("FREE");
    expect(res.body.user.limiteAlunos).toBe(3);
  });

  // Fase 90: concessão manual com prazo ("brinde por tempo limitado") + tier
  // BASE (antes só dava pra conceder PLUS) + confirmação de e-mail manual.
  it("resposta de setUserPremium nunca vaza passwordHash/refreshTokenHash", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.refreshTokenHash).toBeUndefined();
  });

  it("concede Base (não Plus) a um PERSONAL com prazo de 30 dias", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetPersonalId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true, tier: "BASE", days: 30 });
    expect(res.status).toBe(200);
    expect(res.body.user.planoAssinatura).toBe("BASE");
    expect(res.body.user.limiteAlunos).toBe(20);
    const expiresAt = new Date(res.body.user.planoAssinaturaExpiresAt).getTime();
    const in29Days = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const in31Days = Date.now() + 31 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(in29Days);
    expect(expiresAt).toBeLessThan(in31Days);

    const logs = await prisma.adminAuditLog.findMany({ where: { adminId, targetUserId: targetPersonalId } });
    expect(logs.some((l) => l.details === "concedido (PERSONAL) por 30 dia(s)")).toBe(true);
  });

  it("Base concedido com prazo já vencido reverte sozinho pra FREE ao criar um novo vínculo", async () => {
    await prisma.user.update({
      where: { id: targetPersonalId },
      data: { planoAssinaturaExpiresAt: new Date(Date.now() - 1000) },
    });

    const alunoNovo = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "admin_premium_test_expirado_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });

    const res = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoNovo.body.user.id });
    // Limite FREE (3) já deve ter sido atingido só pelo aluno original do
    // teste — a resposta importa menos aqui do que o efeito colateral: o
    // plano deve ter revertido no banco independente do resultado da chamada.
    void res;

    const reverted = await prisma.user.findUnique({ where: { id: targetPersonalId } });
    expect(reverted?.planoAssinatura).toBe("FREE");
    expect(reverted?.limiteAlunos).toBe(3);
    expect(reverted?.planoAssinaturaExpiresAt).toBeNull();

    await prisma.user.deleteMany({ where: { email: "admin_premium_test_expirado_aluno@thunderafit.test" } });
  });

  it("días inválido (0 ou negativo) é rejeitado com 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/premium`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true, days: 0 });
    expect(res.status).toBe(400);
  });
});

describe("Fase 90 — PUT /api/admin/users/:id/verify-email", () => {
  it("PERSONAL (não-admin) recebe 403", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/verify-email`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(res.status).toBe(403);
  });

  it("usuário inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .put("/api/admin/users/00000000-0000-0000-0000-000000000000/verify-email")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("marca um usuário não verificado como verificado, com entrada em AdminAuditLog", async () => {
    const before = await prisma.user.findUnique({ where: { id: targetAlunoId } });
    expect(before?.emailVerifiedAt).toBeNull();

    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/verify-email`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).not.toBeNull();
    expect(res.body.user.passwordHash).toBeUndefined();

    const logs = await prisma.adminAuditLog.findMany({ where: { adminId, targetUserId: targetAlunoId } });
    expect(logs.some((l) => l.action === "EMAIL_VERIFIED_BY_ADMIN")).toBe(true);
  });

  it("é idempotente — reaplicar em quem já está verificado não muda a data nem duplica o log", async () => {
    const before = await prisma.user.findUnique({ where: { id: targetAlunoId } });

    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/verify-email`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(new Date(res.body.user.emailVerifiedAt).getTime()).toBe(before!.emailVerifiedAt!.getTime());

    const logs = await prisma.adminAuditLog.findMany({
      where: { adminId, targetUserId: targetAlunoId, action: "EMAIL_VERIFIED_BY_ADMIN" },
    });
    expect(logs.length).toBe(1);
  });
});
