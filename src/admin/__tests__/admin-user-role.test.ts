import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let adminToken: string;
let adminId: string;
let personalToken: string;
let targetAlunoId: string;

const TEST_EMAILS = [
  "admin_role_test_root@thunderafit.test",
  "admin_role_test_second_admin@thunderafit.test",
  "admin_role_test_personal@thunderafit.test",
  "admin_role_test_aluno@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  const admin = await prisma.user.create({
    data: {
      email: "admin_role_test_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  const adminLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_role_test_root@thunderafit.test", password: "SenhaSegura@123" });
  adminToken = adminLogin.body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({
      email: "admin_role_test_personal@thunderafit.test",
      password: "SenhaSegura@123",
      role: "PERSONAL",
    });
  const personalLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_role_test_personal@thunderafit.test", password: "SenhaSegura@123" });
  personalToken = personalLogin.body.accessToken;

  const aluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({
      email: "admin_role_test_aluno@thunderafit.test",
      password: "SenhaSegura@123",
      role: "ALUNO",
    });
  targetAlunoId = aluno.body.user.id;
});

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId } });
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 33 — PUT /api/admin/users/:id/role", () => {
  it("PERSONAL (não-admin) recebe 403", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/role`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ role: "PERSONAL" });
    expect(res.status).toBe(403);
  });

  it("usuário inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .put("/api/admin/users/00000000-0000-0000-0000-000000000000/role")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "PERSONAL" });
    expect(res.status).toBe(404);
  });

  it("role inválida recebe 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "SUPERUSUARIO" });
    expect(res.status).toBe(400);
  });

  it("admin tentando editar a própria role recebe 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${adminId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "PERSONAL" });
    expect(res.status).toBe(400);
  });

  it("remover o último ADMIN restante recebe 400", async () => {
    // O banco de dev pode ter outros ADMINs além dos dois de teste (ex: um
    // admin criado manualmente pra outro fim) — por isso a checagem de
    // "último admin" tem que ser isolada de qualquer estado pré-existente:
    // rebaixamos temporariamente todo admin que não seja o `secondAdmin`
    // criado abaixo, garantindo que `secondAdmin` é o único ADMIN de
    // verdade no momento da asserção, e restauramos os roles originais no
    // final (sucesso ou falha do teste).
    const secondAdmin = await prisma.user.create({
      data: {
        email: "admin_role_test_second_admin@thunderafit.test",
        passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
        role: "ADMIN",
      },
    });

    const otherAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", id: { not: secondAdmin.id } },
      select: { id: true },
    });
    const otherAdminIds = otherAdmins.map((u) => u.id);
    if (otherAdminIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherAdminIds } },
        data: { role: "PERSONAL" },
      });
    }

    try {
      // secondAdmin agora é o ÚNICO ADMIN do banco. O token original
      // (adminToken) continua válido e com role=ADMIN no JWT — a
      // autenticação é stateless, não reconsulta o banco a cada requisição
      // — então serve como um ator "diferente" pra testar o guard sem
      // depender de auto-edição.
      const demoteLast = await supertest(server.server)
        .put(`/api/admin/users/${secondAdmin.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "PERSONAL" });
      expect(demoteLast.status).toBe(400);

      const stillAdmin = await prisma.user.findUnique({ where: { id: secondAdmin.id } });
      expect(stillAdmin?.role).toBe("ADMIN");
    } finally {
      if (otherAdminIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: otherAdminIds } },
          data: { role: "ADMIN" },
        });
      }
      await prisma.user.delete({ where: { id: secondAdmin.id } });
    }
  });

  it("edição de role bem-sucedida grava entrada em AdminAuditLog", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/users/${targetAlunoId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "NUTRICIONISTA" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("NUTRICIONISTA");

    const logs = await prisma.adminAuditLog.findMany({
      where: { adminId, targetUserId: targetAlunoId },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe("ROLE_CHANGE");
    expect(logs[0].details).toBe("ALUNO -> NUTRICIONISTA");
  });
});
