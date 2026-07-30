import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../prisma";
import {
  getPersonalAccessStatus,
  assertPersonalCanPrescribe,
  assertAlunoWorkoutAccessible,
  PERSONAL_OVER_LIMIT_GRACE_DAYS,
} from "../plan-expiry";

let server: import("fastify").FastifyInstance;
let personalId: string;

const pw = "SenhaSegura@123";

async function linkAlunos(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const email = `plexp_aluno_${Date.now()}_${i}@thunderafit.test`;
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email, password: pw, role: "ALUNO" });
    ids.push(reg.body.user.id);
    await prisma.clientRelation.create({ data: { personalId, alunoId: reg.body.user.id } });
  }
  return ids;
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const reg = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "plexp_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalId = reg.body.user.id;
});

afterAll(async () => {
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "plexp_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("getPersonalAccessStatus", () => {
  it("personalId nulo nunca bloqueia, sem tocar no banco", async () => {
    const status = await getPersonalAccessStatus(null);
    expect(status).toEqual({ blocked: false, overLimit: false, graceDaysLeft: null });
  });

  it("dentro do limite (FREE, 3 alunos): não é excesso, não bloqueia", async () => {
    await linkAlunos(3);
    const status = await getPersonalAccessStatus(personalId);
    expect(status).toEqual({ blocked: false, overLimit: false, graceDaysLeft: null });
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    expect(user?.overLimiteAlunosSince).toBeNull();
  });

  it("acima do limite pela 1ª vez: overLimit true, ainda dentro da carência, grava overLimiteAlunosSince", async () => {
    await linkAlunos(1); // 4 no total, limite FREE é 3
    const status = await getPersonalAccessStatus(personalId);
    expect(status.overLimit).toBe(true);
    expect(status.blocked).toBe(false);
    expect(status.graceDaysLeft).toBe(PERSONAL_OVER_LIMIT_GRACE_DAYS);
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    expect(user?.overLimiteAlunosSince).not.toBeNull();
  });

  it("chamada seguinte não reseta overLimiteAlunosSince (mesma marca de tempo)", async () => {
    const before = (await prisma.user.findUnique({ where: { id: personalId } }))!
      .overLimiteAlunosSince;
    await getPersonalAccessStatus(personalId);
    const after = (await prisma.user.findUnique({ where: { id: personalId } }))!
      .overLimiteAlunosSince;
    expect(after?.getTime()).toBe(before?.getTime());
  });

  it("passada a carência (overLimiteAlunosSince manipulado pro passado): blocked true", async () => {
    const past = new Date(Date.now() - (PERSONAL_OVER_LIMIT_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: personalId }, data: { overLimiteAlunosSince: past } });
    const status = await getPersonalAccessStatus(personalId);
    expect(status).toEqual({ blocked: true, overLimit: true, graceDaysLeft: null });
  });

  it("recuperação: desvincular alunos até voltar ao limite limpa overLimiteAlunosSince", async () => {
    const relations = await prisma.clientRelation.findMany({ where: { personalId } });
    // Remove o suficiente pra voltar a 3 (limite FREE).
    const toRemove = relations.slice(0, relations.length - 3);
    for (const rel of toRemove) {
      await prisma.clientRelation.delete({ where: { id: rel.id } });
    }
    const status = await getPersonalAccessStatus(personalId);
    expect(status).toEqual({ blocked: false, overLimit: false, graceDaysLeft: null });
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    expect(user?.overLimiteAlunosSince).toBeNull();
  });
});

describe("assertPersonalCanPrescribe / assertAlunoWorkoutAccessible", () => {
  it("assertPersonalCanPrescribe não lança quando dentro do limite", async () => {
    await expect(assertPersonalCanPrescribe(personalId)).resolves.toBeUndefined();
  });

  it("assertAlunoWorkoutAccessible não lança pra personalId nulo (programa origin: SELF)", async () => {
    await expect(assertAlunoWorkoutAccessible(null)).resolves.toBeUndefined();
  });

  it("as duas lançam 403 com o code certo quando bloqueado", async () => {
    await linkAlunos(1); // volta a 4, acima do limite de novo
    const past = new Date(Date.now() - (PERSONAL_OVER_LIMIT_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: personalId }, data: { overLimiteAlunosSince: past } });

    await expect(assertPersonalCanPrescribe(personalId)).rejects.toMatchObject({
      statusCode: 403,
      code: "PERSONAL_OVER_LIMIT",
    });
    await expect(assertAlunoWorkoutAccessible(personalId)).rejects.toMatchObject({
      statusCode: 403,
      code: "PERSONAL_PLAN_RESTRICTED",
    });
  });
});
