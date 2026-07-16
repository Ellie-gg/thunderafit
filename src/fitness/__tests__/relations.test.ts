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

describe("GET /api/users/lookup", () => {
  it("encontra um aluno existente pelo e-mail", async () => {
    const r = await supertest(server.server)
      .get("/api/users/lookup")
      .query({ email: "test_aluno4@thunderafit.test" })
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.user.id).toBe(studentIds[3]);
    expect(r.body.user.role).toBe("ALUNO");
  });

  it("retorna 404 para e-mail inexistente", async () => {
    const r = await supertest(server.server)
      .get("/api/users/lookup")
      .query({ email: "nao_existe_ninguem@thunderafit.test" })
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(404);
    expect(r.body.error).toBeDefined();
  });

  it("retorna 404 ao buscar um Personal (não é ALUNO)", async () => {
    const r = await supertest(server.server)
      .get("/api/users/lookup")
      .query({ email: "test_personal@thunderafit.test" })
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(404);
  });
});

describe("Fase 11 — Nutricionista como segundo tipo de profissional (limite por profissional)", () => {
  let nutriToken: string;
  let nutriId: string;

  beforeAll(async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "test_nutri@thunderafit.test", password: "SenhaSegura@123", role: "NUTRICIONISTA" });
    nutriId = reg.body.user.id;

    const login = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "test_nutri@thunderafit.test", password: "SenhaSegura@123" });
    nutriToken = login.body.accessToken;
  });

  it("aluno já no limite (3/3) do Personal ainda pode ser vinculado a um Nutricionista com vaga livre", async () => {
    // studentIds[0] já está vinculado ao Personal (3/3 ocupado nesse Personal).
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId: studentIds[0] });
    expect(r.status).toBe(201);
    expect(r.body.relation.professionalType).toBe("NUTRICIONISTA");
    expect(r.body.relation.personalId).toBe(nutriId);
  });

  it("GET /api/relations do Nutricionista retorna só o vínculo dele, não os do Personal", async () => {
    const r = await supertest(server.server)
      .get("/api/relations")
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(r.status).toBe(200);
    expect(r.body.relations).toHaveLength(1);
    expect(r.body.relations[0].id).toBe(studentIds[0]);
  });

  it("Nutricionista atinge o próprio limite (3) independente do Personal já estar 3/3", async () => {
    for (let i = 1; i < 3; i++) {
      const r = await supertest(server.server)
        .post("/api/relations")
        .set("Authorization", `Bearer ${nutriToken}`)
        .send({ alunoId: studentIds[i] });
      expect(r.status).toBe(201);
    }
    const r4 = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId: studentIds[3] });
    expect(r4.status).toBe(403);
  });

  it("GET /api/relations do Personal continua mostrando 3, sem contaminação do Nutricionista", async () => {
    const r = await supertest(server.server)
      .get("/api/relations")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.relations).toHaveLength(3);
  });

  it("um ALUNO autenticado não pode chamar POST /api/relations (403)", async () => {
    const loginAluno = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "test_aluno1@thunderafit.test", password: "SenhaSegura@123" });
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${loginAluno.body.accessToken}`)
      .send({ alunoId: studentIds[1] });
    expect(r.status).toBe(403);
  });
});
