import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let adminToken: string;
let adminId: string;
let personalToken: string;

const TEST_EMAILS = [
  "admin_del_test_root@thunderafit.test",
  "admin_del_test_second_admin@thunderafit.test",
  "admin_del_test_personal@thunderafit.test",
  "admin_del_test_personal2@thunderafit.test",
  "admin_del_test_aluno@thunderafit.test",
  "admin_del_test_aluno2@thunderafit.test",
  "admin_del_test_aluno3@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  const admin = await prisma.user.create({
    data: {
      email: "admin_del_test_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  const adminLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_del_test_root@thunderafit.test", password: "SenhaSegura@123" });
  adminToken = adminLogin.body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_del_test_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  const personalLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_del_test_personal@thunderafit.test", password: "SenhaSegura@123" });
  personalToken = personalLogin.body.accessToken;
}, 30000);

afterAll(async () => {
  await prisma.adminAuditLog.deleteMany({ where: { adminId } });
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
}, 30000);

describe("Fase 80 — DELETE /api/admin/users/:id", () => {
  it("PERSONAL (não-admin) recebe 403", async () => {
    const res = await supertest(server.server)
      .delete(`/api/admin/users/${adminId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(res.status).toBe(403);
  });

  it("usuário inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .delete("/api/admin/users/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("admin tentando remover a própria conta recebe 400", async () => {
    const res = await supertest(server.server)
      .delete(`/api/admin/users/${adminId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("remover o último ADMIN restante recebe 400", async () => {
    // Mesmo isolamento de "último admin" já usado em admin-user-role.test.ts.
    const secondAdmin = await prisma.user.create({
      data: {
        email: "admin_del_test_second_admin@thunderafit.test",
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
      await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { role: "PERSONAL" } });
    }
    try {
      const res = await supertest(server.server)
        .delete(`/api/admin/users/${secondAdmin.id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      const stillExists = await prisma.user.findUnique({ where: { id: secondAdmin.id } });
      expect(stillExists).not.toBeNull();
    } finally {
      if (otherAdminIds.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { role: "ADMIN" } });
      }
      await prisma.user.delete({ where: { id: secondAdmin.id } });
    }
  });

  it("remove um aluno simples (sem nenhum dado relacionado) com sucesso e grava AdminAuditLog", async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "admin_del_test_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
    const alunoId = reg.body.user.id;

    const res = await supertest(server.server)
      .delete(`/api/admin/users/${alunoId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const gone = await prisma.user.findUnique({ where: { id: alunoId } });
    expect(gone).toBeNull();

    const logs = await prisma.adminAuditLog.findMany({ where: { adminId, targetUserId: alunoId } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe("USER_DELETE");
    expect(logs[0].details).toContain("admin_del_test_aluno@thunderafit.test");
  });

  it("remove um aluno com dado relacionado completo (vínculo, notificação, login log, anamnese, treino próprio, contato) sem erro, e limpa tudo", async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "admin_del_test_aluno2@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
    const alunoId = reg.body.user.id;
    const alunoLoginRes = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_del_test_aluno2@thunderafit.test", password: "SenhaSegura@123" });
    const alunoToken = alunoLoginRes.body.accessToken;

    const personalUser = await prisma.user.findUnique({
      where: { email: "admin_del_test_personal@thunderafit.test" },
    });

    // Vínculo direto (ClientRelation)
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId });

    // Anamnese própria
    await supertest(server.server)
      .post("/api/anamnesis")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ fullName: "Aluno de Teste de Remoção" });

    // Fale Conosco
    await supertest(server.server)
      .post("/api/contact")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ title: "Teste", message: "Mensagem de teste antes da remoção." });

    // Programa/treino próprio do aluno — criado direto via Prisma (o
    // endpoint POST /api/workout-programs é restrito a PERSONAL/NUTRICIONISTA;
    // o que importa testar aqui é o cascade de remoção, não o fluxo de criação).
    const ownProgram = await prisma.workoutProgram.create({
      data: { name: "Programa do aluno a remover", alunoId, origin: "PERSONAL", isTemplate: false },
    });

    const rel = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: personalUser!.id, alunoId } },
    });
    expect(rel).not.toBeNull();

    const res = await supertest(server.server)
      .delete(`/api/admin/users/${alunoId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const gone = await prisma.user.findUnique({ where: { id: alunoId } });
    expect(gone).toBeNull();
    const relGone = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: personalUser!.id, alunoId } },
    });
    expect(relGone).toBeNull();
    const anamnesisGone = await prisma.anamnesis.findUnique({ where: { alunoId } });
    expect(anamnesisGone).toBeNull();
    const programGone = await prisma.workoutProgram.findUnique({ where: { id: ownProgram.id } });
    expect(programGone).toBeNull();
    const contactGone = await prisma.contactMessage.findMany({ where: { userId: alunoId } });
    expect(contactGone).toHaveLength(0);
  }, 20000);

  it("remover um Personal só órfã (não apaga) os programas que ele criou pra outros alunos", async () => {
    const proReg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "admin_del_test_personal2@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
    const proId = proReg.body.user.id;
    const proLoginRes = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_del_test_personal2@thunderafit.test", password: "SenhaSegura@123" });
    const proToken = proLoginRes.body.accessToken;

    const alunoReg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "admin_del_test_aluno3@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
    const alunoId = alunoReg.body.user.id;

    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${proToken}`)
      .send({ alunoId });

    // Programa que o Personal PRESCREVEU pro aluno — personalId = quem criou,
    // alunoId = outro usuário (que sobrevive à remoção do Personal).
    const prescribed = await prisma.workoutProgram.create({
      data: { name: "Programa prescrito pelo Personal", personalId: proId, alunoId, origin: "PERSONAL" },
    });
    const programId = prescribed.id;

    const res = await supertest(server.server)
      .delete(`/api/admin/users/${proId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // O programa do aluno sobrevive — só perde o personalId.
    const survivingProgram = await prisma.workoutProgram.findUnique({ where: { id: programId } });
    expect(survivingProgram).not.toBeNull();
    expect(survivingProgram?.personalId).toBeNull();
    expect(survivingProgram?.alunoId).toBe(alunoId);

    await prisma.workoutProgram.deleteMany({ where: { id: programId } });
    await prisma.clientRelation.deleteMany({ where: { alunoId } });
    await prisma.user.deleteMany({ where: { id: { in: [alunoId] } } });
  }, 20000);
});
