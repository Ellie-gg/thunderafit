import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalId: string;
let aluno1Id: string;
let aluno2Id: string;
let tokenPersonal: string;
let tokenAluno1: string;
let tokenAluno2: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_anamnesis_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;

  const regAluno1 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_anamnesis_aluno1@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  aluno1Id = regAluno1.body.user.id;

  const regAluno2 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_anamnesis_aluno2@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  aluno2Id = regAluno2.body.user.id;

  const loginPersonal = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_anamnesis_personal@thunderafit.test", password: "SenhaSegura@123" });
  tokenPersonal = loginPersonal.body.accessToken;

  const loginAluno1 = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_anamnesis_aluno1@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno1 = loginAluno1.body.accessToken;

  const loginAluno2 = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_anamnesis_aluno2@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno2 = loginAluno2.body.accessToken;

  // Só aluno1 é vinculado ao personal
  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId: aluno1Id });
});

afterAll(async () => {
  await prisma.anamnesis.deleteMany({ where: { alunoId: { in: [aluno1Id, aluno2Id] } } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_anamnesis_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("POST /api/anamnesis", () => {
  it("aluno cria a própria anamnese com 201", async () => {
    const r = await supertest(server.server)
      .post("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ fullName: "Aluno Um", goals: "Ganhar massa muscular", injuries: "Nenhuma" });
    expect(r.status).toBe(201);
    expect(r.body.anamnesis.fullName).toBe("Aluno Um");
  });

  it("retorna 409 ao tentar criar de novo", async () => {
    const r = await supertest(server.server)
      .post("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ fullName: "Duplicado" });
    expect(r.status).toBe(409);
  });

  it("retorna 403 se um PERSONAL tentar criar", async () => {
    const r = await supertest(server.server)
      .post("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenPersonal}`)
      .send({ fullName: "x" });
    expect(r.status).toBe(403);
  });
});

describe("PUT /api/anamnesis", () => {
  it("aluno edita a própria anamnese", async () => {
    const r = await supertest(server.server)
      .put("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ goals: "Perder gordura" });
    expect(r.status).toBe(200);
    expect(r.body.anamnesis.goals).toBe("Perder gordura");
  });

  it("retorna 404 se o aluno ainda não tem anamnese criada", async () => {
    const r = await supertest(server.server)
      .put("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenAluno2}`)
      .send({ goals: "x" });
    expect(r.status).toBe(404);
  });
});

describe("GET /api/anamnesis", () => {
  it("aluno vê a própria anamnese", async () => {
    const r = await supertest(server.server)
      .get("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(r.status).toBe(200);
    expect(r.body.anamnesis.goals).toBe("Perder gordura");
  });

  it("aluno sem anamnese ainda recebe null, não erro", async () => {
    const r = await supertest(server.server)
      .get("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenAluno2}`);
    expect(r.status).toBe(200);
    expect(r.body.anamnesis).toBeNull();
  });

  it("PERSONAL sem alunoId retorna 403", async () => {
    const r = await supertest(server.server)
      .get("/api/anamnesis")
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(403);
  });

  it("PERSONAL vinculado consegue ver a anamnese do aluno via ?alunoId=", async () => {
    const r = await supertest(server.server)
      .get(`/api/anamnesis?alunoId=${aluno1Id}`)
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(200);
    expect(r.body.anamnesis.goals).toBe("Perder gordura");
  });

  it("PERSONAL NÃO vinculado ao aluno recebe 403", async () => {
    const r = await supertest(server.server)
      .get(`/api/anamnesis?alunoId=${aluno2Id}`)
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(403);
  });
});
