import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
  import { randomUUID } from "crypto";

let server: import("fastify").FastifyInstance;
let accessToken: string;
let personalId: string;
let studentIds: string[] = [];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  // Register personal
  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;

  // Register 4 students
  for (let i = 0; i < 4; i++) {
    const res = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: `test_aluno${i + 1}@thunderafit.test`, password: "SenhaSegura@123", role: "ALUNO" });
    studentIds.push(res.body.user.id);
  }

  // Login personal to get token
  const loginRes = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_personal@thunderafit.test", password: "SenhaSegura@123" });
  accessToken = loginRes.body.accessToken;
});

afterAll(async () => {
  await prisma.clientRelation.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: "test_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("POST /api/relations", () => {
  it("vincula OS 3 primeiros alunos com 201", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await supertest(server.server)
        .post("/api/relations")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ alunoId: studentIds[i] });
      expect(r.status).toBe(201);
      expect(r.body.relation).toBeDefined();
      expect(r.body.relation.id).toBeDefined();
    }
  });

  it("tenta vincular o 4º aluno e recebe 403", async () => {
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: studentIds[3] });
    expect(r.status).toBe(403);
    expect(r.body.error).toBeDefined();
  });

  it("tenta vincular o mesmo aluno (1º) ainda retorna 409", async () => {
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: studentIds[0] });
    expect(r.status).toBe(409);
    expect(r.body.error).toBeDefined();
  });

  it("tenta vincular alunoId inexistente retorna 404", async () => {
    const fakeId = randomUUID();
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: fakeId });
    expect(r.status).toBe(404);
    expect(r.body.error).toBeDefined();
  });

  it("GET /api/relations retorna lista de 3 alunos vinculados", async () => {
    const r = await supertest(server.server)
      .get("/api/relations")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.relations).toHaveLength(3);
  });
});
