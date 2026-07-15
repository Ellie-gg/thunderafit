import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalId: string;
let tokenPersonal: string;
let tokenAluno1: string;
let tokenAluno2: string;
let workoutId: string;
let otherWorkoutId: string;
let workoutExerciseId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_setlog_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;

  const regAluno1 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_setlog_aluno1@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  const aluno1Id = regAluno1.body.user.id;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_setlog_aluno2@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });

  const loginPersonal = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_setlog_personal@thunderafit.test", password: "SenhaSegura@123" });
  tokenPersonal = loginPersonal.body.accessToken;

  const loginAluno1 = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_setlog_aluno1@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno1 = loginAluno1.body.accessToken;

  const loginAluno2 = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_setlog_aluno2@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno2 = loginAluno2.body.accessToken;

  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId: aluno1Id });

  const workoutRes = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId: aluno1Id, name: "Treino Teste SetLog", letter: "A" });
  workoutId = workoutRes.body.workout.id;

  const otherWorkoutRes = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId: aluno1Id, name: "Outro Treino", letter: "B" });
  otherWorkoutId = otherWorkoutRes.body.workout.id;

  const exercise = await prisma.exercise.findFirst({ orderBy: { name: "asc" } });

  const weRes = await supertest(server.server)
    .post(`/api/workouts/${workoutId}/exercises`)
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ exerciseId: exercise!.id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
  workoutExerciseId = weRes.body.workoutExercise.id;
});

afterAll(async () => {
  await prisma.setLog.deleteMany({ where: { workoutExerciseId } });
  await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: [workoutId, otherWorkoutId] } } });
  await prisma.workout.deleteMany({ where: { personalId } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_setlog_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("POST /api/workouts/:workoutId/exercises/:workoutExerciseId/logs", () => {
  it("registra série com usuário dono retorna 201", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 60 });
    expect(r.status).toBe(201);
    expect(r.body.setLog.id).toBeDefined();
  });

  it("registra série com usuário não-dono retorna 403", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${tokenAluno2}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 60 });
    expect(r.status).toBe(403);
    expect(r.body.error).toBeDefined();
  });

  it("registra série com workoutExerciseId de outro treino retorna 400", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${otherWorkoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 60 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBeDefined();
  });

  it("registra mais duas séries com sucesso", async () => {
    const r2 = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ setNumber: 2, repsDone: 9, weightKg: 60 });
    expect(r2.status).toBe(201);

    const r3 = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ setNumber: 3, repsDone: 8, weightKg: 65 });
    expect(r3.status).toBe(201);
  });
});

describe("GET /api/workouts/:workoutId/exercises/:workoutExerciseId/logs", () => {
  it("retorna as séries na ordem correta", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(r.status).toBe(200);
    expect(r.body.setLogs).toHaveLength(3);
    expect(r.body.setLogs.map((s: any) => s.setNumber)).toEqual([1, 2, 3]);
  });
});

describe("GET /api/workouts/:id com setLogs aninhados", () => {
  it("inclui setLogs aninhados corretamente", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(r.status).toBe(200);
    expect(r.body.workout.exercises[0].setLogs).toHaveLength(3);
  });

  it("retorna 403 para usuário não autorizado", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${tokenAluno2}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBeDefined();
  });
});
