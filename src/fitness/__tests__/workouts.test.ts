import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import exercisesSeed from "../../../data/exercises_seed.json";

let server: import("fastify").FastifyInstance;
let accessToken: string;
let alunoAccessToken: string;
let personalId: string;
let vinculadoAlunoId: string;
let naoVinculadoAlunoId: string;
let workoutId: string;
let exerciseIds: string[] = [];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_workout_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;

  const regAluno1 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_workout_aluno1@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  vinculadoAlunoId = regAluno1.body.user.id;

  const regAluno2 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_workout_aluno2@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  naoVinculadoAlunoId = regAluno2.body.user.id;

  const loginRes = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_workout_personal@thunderafit.test", password: "SenhaSegura@123" });
  accessToken = loginRes.body.accessToken;

  const loginAlunoRes = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_workout_aluno1@thunderafit.test", password: "SenhaSegura@123" });
  alunoAccessToken = loginAlunoRes.body.accessToken;

  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ alunoId: vinculadoAlunoId });

  const exercises = await prisma.exercise.findMany({ take: 5, orderBy: { name: "asc" } });
  exerciseIds = exercises.map((e) => e.id);
});

afterAll(async () => {
  await prisma.workoutExercise.deleteMany({ where: { workoutId } });
  await prisma.workout.deleteMany({ where: { personalId } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_workout_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("GET /api/exercises", () => {
  it("retorna a lista completa de exercícios do catálogo", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(exercisesSeed.length);
  });

  it("todo exercício traz difficultyLevel válido (Fase 15)", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${accessToken}`);
    const validos = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"];
    expect(r.body.exercises.every((e: any) => validos.includes(e.difficultyLevel))).toBe(true);
  });

  it("?muscleGroup=Peito retorna só exercícios de Peito (filtro aditivo, Fase 15)", async () => {
    const esperado = exercisesSeed.filter((e: any) => e.muscleGroup === "Peito").length;
    const r = await supertest(server.server)
      .get("/api/exercises?muscleGroup=Peito")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(esperado);
    expect(r.body.exercises.every((e: any) => e.muscleGroup === "Peito")).toBe(true);
  });

  it("?muscleGroup inexistente retorna lista vazia, sem erro", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises?muscleGroup=NaoExiste")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.exercises).toHaveLength(0);
  });
});

describe("POST /api/workouts", () => {
  it("cria treino para aluno vinculado com 201", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Treino A - Peito e Tríceps", letter: "A" });
    expect(r.status).toBe(201);
    expect(r.body.workout.id).toBeDefined();
    workoutId = r.body.workout.id;
  });

  it("tenta criar treino para aluno não vinculado retorna 403", async () => {
    const r = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: naoVinculadoAlunoId, name: "Treino B", letter: "B" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBeDefined();
  });
});

describe("POST /api/workouts/:id/exercises", () => {
  it("adiciona exercícios ao treino criado", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await supertest(server.server)
        .post(`/api/workouts/${workoutId}/exercises`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          exerciseId: exerciseIds[i],
          sets: 3,
          repsRange: "8-12",
          restSeconds: 60,
          order: i + 1,
        });
      expect(r.status).toBe(201);
      expect(r.body.workoutExercise.id).toBeDefined();
    }
  });
});

describe("POST /api/workouts/:id/exercises/:exerciseId/move (Fase 28)", () => {
  it("move o 2º exercício pra cima → troca de posição com o 1º", async () => {
    const before = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const [first, second] = before.body.workout.exercises;

    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${second.id}/move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ direction: "up" });
    expect(r.status).toBe(200);

    const after = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(after.body.workout.exercises[0].id).toBe(second.id);
    expect(after.body.workout.exercises[1].id).toBe(first.id);
    expect(after.body.workout.exercises[0].order).toBe(first.order);
    expect(after.body.workout.exercises[1].order).toBe(second.order);
  });

  it("mover o primeiro exercício pra cima retorna 400 (já é o primeiro)", async () => {
    const list = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const firstId = list.body.workout.exercises[0].id;

    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${firstId}/move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ direction: "up" });
    expect(r.status).toBe(400);
  });

  it("mover o último exercício pra baixo retorna 400 (já é o último)", async () => {
    const list = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const lastId = list.body.workout.exercises[list.body.workout.exercises.length - 1].id;

    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${lastId}/move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ direction: "down" });
    expect(r.status).toBe(400);
  });

  it("direction inválida retorna 400", async () => {
    const list = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const anyId = list.body.workout.exercises[0].id;

    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${anyId}/move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ direction: "sideways" });
    expect(r.status).toBe(400);
  });

  it("aluno (não dono do treino) não pode reordenar — 404 (mesma semântica de posse do addExercise)", async () => {
    const list = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const anyId = list.body.workout.exercises[0].id;

    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${anyId}/move`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ direction: "down" });
    expect(r.status).toBe(404);
  });
});

describe("GET /api/workouts", () => {
  it("aluno vê apenas os treinos onde é o alunoId", async () => {
    const r = await supertest(server.server)
      .get("/api/workouts")
      .set("Authorization", `Bearer ${alunoAccessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts.length).toBeGreaterThanOrEqual(1);
    expect(r.body.workouts.every((w: any) => w.alunoId === vinculadoAlunoId)).toBe(true);
  });

  it("personal vê apenas os treinos que prescreveu", async () => {
    const r = await supertest(server.server)
      .get("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts.every((w: any) => w.personalId === personalId)).toBe(true);
  });
});

describe("GET /api/workouts/:id", () => {
  it("retorna o treino com os exercícios e dados do Exercise incluídos", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workout.exercises).toHaveLength(3);
    expect(r.body.workout.exercises[0].exercise.name).toBeDefined();
    expect(r.body.workout.exercises[0].exercise.mediaUrl).toBeDefined();
    expect(r.body.workout.exercises[0].exercise.description).toBeDefined();
  });
});

describe("POST /api/workouts/:id/complete (Fase 35 — resumo pós-treino)", () => {
  it("retorna workout + summary bem formado, primeira conclusão vira FIRST_TIME", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`);

    expect(r.status).toBe(200);
    expect(r.body.workout.lastCompletedAt).toBeDefined();
    expect(r.body.summary).toMatchObject({
      workoutId,
      workoutName: expect.any(String),
      workoutLetter: expect.any(String),
      volumeKg: 0,
      setsLogged: 0,
      hasHistory: false,
      previousVolumeKg: null,
      volumeChangePercent: null,
      personalRecords: [],
    });
    expect(typeof r.body.summary.streakDays).toBe("number");
  });

  it("aluno não dono do treino recebe 403 ao tentar concluir", async () => {
    const loginRes2 = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "test_workout_aluno2@thunderafit.test", password: "SenhaSegura@123" });

    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/complete`)
      .set("Authorization", `Bearer ${loginRes2.body.accessToken}`);
    expect(r.status).toBe(403);
  });
});
