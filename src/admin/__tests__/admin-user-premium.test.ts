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
});
