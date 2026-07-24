import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalToken: string;
let alunoToken: string;

const pw = "SenhaSegura@123";

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "gen_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "gen_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "gen_aluno@thunderafit.test", password: pw, role: "ALUNO" });
  alunoToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "gen_aluno@thunderafit.test", password: pw })
  ).body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: "gen_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("POST /api/workouts/generate — Montagem Inteligente (motor de regras determinístico)", () => {
  it("gera 3 exercícios pro grupo principal (1º da lista) e 2 pro secundário, com IDs reais do catálogo", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: ["Peito", "Costas"], goal: "hipertrofia" });

    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(5);

    const peito = r.body.exercises.filter((e: any) => e.muscleGroup === "Peito");
    const costas = r.body.exercises.filter((e: any) => e.muscleGroup === "Costas");
    expect(peito).toHaveLength(3);
    expect(costas).toHaveLength(2);

    // order sequencial 1..5, sem pular nem repetir.
    expect(r.body.exercises.map((e: any) => e.order)).toEqual([1, 2, 3, 4, 5]);

    // Todo exerciseId retornado precisa existir de verdade no catálogo.
    for (const ex of r.body.exercises) {
      const found = await prisma.exercise.findUnique({ where: { id: ex.exerciseId } });
      expect(found).not.toBeNull();
      expect(found?.muscleGroup).toBe(ex.muscleGroup);
      expect(found?.name).toBe(ex.exerciseName);
    }
  });

  it("aplica a prescrição certa por objetivo: hipertrofia/força/resistência", async () => {
    const cases: Array<[string, { sets: number; repsRange: string; restSeconds: number }]> = [
      ["hipertrofia", { sets: 3, repsRange: "8-12", restSeconds: 60 }],
      ["forca", { sets: 4, repsRange: "4-6", restSeconds: 120 }],
      ["resistencia", { sets: 3, repsRange: "15-20", restSeconds: 45 }],
    ];
    for (const [goal, expected] of cases) {
      const r = await supertest(server.server)
        .post("/api/workouts/generate")
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ muscleGroups: ["Ombro"], goal });
      expect(r.status).toBe(200);
      for (const ex of r.body.exercises) {
        expect(ex.sets).toBe(expected.sets);
        expect(ex.repsRange).toBe(expected.repsRange);
        expect(ex.restSeconds).toBe(expected.restSeconds);
      }
    }
  });

  it("um único grupo muscular selecionado ainda conta como principal (3 exercícios)", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: ["Bíceps"], goal: "hipertrofia" });
    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(3);
  });

  it("3 grupos selecionados: 3 (principal) + 2 + 2 (secundários) = 7", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: ["Quadríceps", "Abdômen", "Tríceps"], goal: "forca" });
    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(7);
  });

  it("sem muscleGroups (vazio) retorna 400", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: [], goal: "hipertrofia" });
    expect(r.status).toBe(400);
  });

  it("goal inválido retorna 400", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: ["Peito"], goal: "emagrecimento" });
    expect(r.status).toBe(400);
  });

  it("level é opcional — sem informar, usa intermediario e ainda funciona", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: ["Cardio"], goal: "resistencia" });
    expect(r.status).toBe(200);
    expect(r.body.exercises.length).toBeGreaterThan(0);
  });

  it("ALUNO não pode gerar sugestão de treino (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ muscleGroups: ["Peito"], goal: "hipertrofia" });
    expect(r.status).toBe(403);
  });

  it("sem autenticação é bloqueado (401)", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts/generate")
      .send({ muscleGroups: ["Peito"], goal: "hipertrofia" });
    expect(r.status).toBe(401);
  });

  it("nada é persistido: nenhum WorkoutProgram/Workout novo aparece depois da chamada", async () => {
    const before = await prisma.workoutProgram.count();
    await supertest(server.server)
      .post("/api/workouts/generate")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ muscleGroups: ["Peito", "Tríceps"], goal: "hipertrofia" });
    const after = await prisma.workoutProgram.count();
    expect(after).toBe(before);
  });
});
