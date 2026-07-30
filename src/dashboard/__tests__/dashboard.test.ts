import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

/**
 * Fase 96 (triagem de perf 2026-07-29) — GET /api/dashboard/aluno-summary
 * substitui o waterfall de rede do dashboard do aluno (lista de programas →
 * detalhe do programa do Personal/self, lista de planos de dieta → detalhe
 * do plano ativo) por um único round trip, reaproveitando 100% da mesma
 * lógica de autorização/posse dos endpoints já existentes.
 */

let server: import("fastify").FastifyInstance;
let personalToken: string;
let nutriToken: string;
let alunoToken: string;
let alunoId: string;
let exerciseId: string;

const pw = "SenhaSegura@123";
const TEST_EMAILS = [
  "dash_personal@thunderafit.test",
  "dash_nutri@thunderafit.test",
  "dash_aluno@thunderafit.test",
  "dash_aluno_vazio@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "dash_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "dash_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "dash_nutri@thunderafit.test", password: pw, role: "NUTRICIONISTA" });
  nutriToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "dash_nutri@thunderafit.test", password: pw })
  ).body.accessToken;

  const aluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "dash_aluno@thunderafit.test", password: pw, role: "ALUNO" });
  alunoId = aluno.body.user.id;
  alunoToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "dash_aluno@thunderafit.test", password: pw })
  ).body.accessToken;

  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ alunoId });
  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${nutriToken}`)
    .send({ alunoId });

  const exercises = await supertest(server.server)
    .get("/api/exercises")
    .set("Authorization", `Bearer ${personalToken}`);
  exerciseId = exercises.body.exercises[0].id;

  const workout = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ alunoId, name: "Treino Dashboard E2E", letter: "A" });
  await supertest(server.server)
    .post(`/api/workouts/${workout.body.workout.id}/exercises`)
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });

  const plan = await supertest(server.server)
    .post("/api/diet-plans")
    .set("Authorization", `Bearer ${nutriToken}`)
    .send({ alunoId, name: "Plano Dashboard E2E" });
  await supertest(server.server)
    .post(`/api/diet-plans/${plan.body.plan.id}/meals`)
    .set("Authorization", `Bearer ${nutriToken}`)
    .send({ name: "Café da manhã", time: "08:00", order: 1 });

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "dash_aluno_vazio@thunderafit.test", password: pw, role: "ALUNO" });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

describe("GET /api/dashboard/aluno-summary", () => {
  it("PERSONAL/NUTRICIONISTA recebem 403 (rota é só do Aluno)", async () => {
    const res = await supertest(server.server)
      .get("/api/dashboard/aluno-summary")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(res.status).toBe(403);
  });

  it("devolve o programa prescrito pelo Personal e o plano de dieta ativo, num único request", async () => {
    const res = await supertest(server.server)
      .get("/api/dashboard/aluno-summary")
      .set("Authorization", `Bearer ${alunoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.personalProgram).not.toBeNull();
    expect(res.body.personalProgram.workouts[0].exercises[0].exerciseId).toBe(exerciseId);
    expect(res.body.selfProgram).toBeNull();
    expect(res.body.dietPlan).not.toBeNull();
    expect(res.body.dietPlan.name).toBe("Plano Dashboard E2E");
    expect(res.body.dietPlan.meals).toHaveLength(1);
  });

  it("aluno sem nenhum programa/plano recebe os 3 campos null, sem erro", async () => {
    const login = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "dash_aluno_vazio@thunderafit.test", password: pw });

    const res = await supertest(server.server)
      .get("/api/dashboard/aluno-summary")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ personalProgram: null, selfProgram: null, dietPlan: null });
  });
});
