import supertest from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";

const TEST_EMAILS = [
  "self_del_test_aluno@thunderafit.test",
  "self_del_test_aluno_wrongpw@thunderafit.test",
  "self_del_test_aluno_related@thunderafit.test",
  "self_del_test_personal@thunderafit.test",
  "self_del_test_related_personal@thunderafit.test",
  "self_del_test_admin_root@thunderafit.test",
  "self_del_test_admin_second@thunderafit.test",
  "self_del_test_google@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

async function registerAndLogin(email: string, role: "ALUNO" | "PERSONAL" = "ALUNO") {
  const reg = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email, password: pw, role });
  const login = await supertest(server.server).post("/api/auth/login").send({ email, password: pw });
  return { id: reg.body.user.id, token: login.body.accessToken };
}

describe("Fase 81 — DELETE /api/auth/me (excluir minha conta)", () => {
  it("sem autenticação → 401", async () => {
    const res = await supertest(server.server).delete("/api/auth/me").send({ password: pw });
    expect(res.status).toBe(401);
  });

  it("conta tradicional sem enviar senha → 400", async () => {
    const { token } = await registerAndLogin("self_del_test_aluno@thunderafit.test");
    const res = await supertest(server.server)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    const stillThere = await prisma.user.findUnique({ where: { email: "self_del_test_aluno@thunderafit.test" } });
    expect(stillThere).not.toBeNull();
  });

  it("senha incorreta → 401", async () => {
    const { token } = await registerAndLogin("self_del_test_aluno_wrongpw@thunderafit.test");
    const res = await supertest(server.server)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "SenhaErrada@000" });
    expect(res.status).toBe(401);
    const stillThere = await prisma.user.findUnique({
      where: { email: "self_del_test_aluno_wrongpw@thunderafit.test" },
    });
    expect(stillThere).not.toBeNull();
  });

  it("remover o último ADMIN restante recebe 400", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "self_del_test_admin_root@thunderafit.test",
        passwordHash: await bcrypt.hash(pw, 12),
        role: "ADMIN",
      },
    });
    const adminLogin = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "self_del_test_admin_root@thunderafit.test", password: pw });
    const otherAdmins = await prisma.user.findMany({ where: { role: "ADMIN", id: { not: admin.id } }, select: { id: true } });
    const otherAdminIds = otherAdmins.map((u) => u.id);
    if (otherAdminIds.length > 0) {
      await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { role: "PERSONAL" } });
    }
    try {
      const res = await supertest(server.server)
        .delete("/api/auth/me")
        .set("Authorization", `Bearer ${adminLogin.body.accessToken}`)
        .send({ password: pw });
      expect(res.status).toBe(400);
      const stillThere = await prisma.user.findUnique({ where: { id: admin.id } });
      expect(stillThere).not.toBeNull();
    } finally {
      if (otherAdminIds.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: otherAdminIds } }, data: { role: "ADMIN" } });
      }
    }
  });

  it("remove uma conta simples com sucesso e limpa os cookies de sessão", async () => {
    const { token } = await registerAndLogin("self_del_test_personal@thunderafit.test", "PERSONAL");
    const res = await supertest(server.server)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: pw });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const setCookieHeader = res.headers["set-cookie"];
    expect(setCookieHeader).toBeDefined();
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    expect(cookies.some((c: string) => c.startsWith("access_token=;"))).toBe(true);
    expect(cookies.some((c: string) => c.startsWith("refresh_token=;"))).toBe(true);

    const gone = await prisma.user.findUnique({ where: { email: "self_del_test_personal@thunderafit.test" } });
    expect(gone).toBeNull();
  });

  it("remove uma conta com dado relacionado (vínculo) com sucesso, e limpa tudo", async () => {
    const { token: personalToken } = await registerAndLogin(
      "self_del_test_related_personal@thunderafit.test" as any,
      "PERSONAL"
    );
    const { id: alunoId, token: alunoToken } = await registerAndLogin("self_del_test_aluno_related@thunderafit.test");

    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId });

    const personalUser = await prisma.user.findUnique({
      where: { email: "self_del_test_related_personal@thunderafit.test" },
    });
    const rel = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: personalUser!.id, alunoId } },
    });
    expect(rel).not.toBeNull();

    const res = await supertest(server.server)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ password: pw });
    expect(res.status).toBe(200);

    const gone = await prisma.user.findUnique({ where: { id: alunoId } });
    expect(gone).toBeNull();
    const relGone = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: personalUser!.id, alunoId } },
    });
    expect(relGone).toBeNull();

    await prisma.user.deleteMany({ where: { email: "self_del_test_related_personal@thunderafit.test" } });
  });

  it("conta só-Google (sem senha) pode se auto-excluir sem enviar password", async () => {
    const googleUser = await prisma.user.create({
      data: {
        email: "self_del_test_google@thunderafit.test",
        passwordHash: null,
        role: "ALUNO",
        googleId: "google-sub-self-delete-test",
      },
    });
    const payload = { sub: googleUser.id, email: googleUser.email, role: googleUser.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string);

    const res = await supertest(server.server)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);

    const gone = await prisma.user.findUnique({ where: { id: googleUser.id } });
    expect(gone).toBeNull();
  });
});
