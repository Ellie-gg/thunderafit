import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalId: string;
let alunoId: string;
let tokenPersonal: string;
let tokenAluno: string;
let tokenAluno2: string;
let workoutId: string;
let otherWorkoutId: string;
let exerciseAId: string;
let exerciseBId: string;
let exerciseCId: string;
let workoutExerciseAId: string;
let workoutExerciseAId2: string; // exercício B, no segundo treino (usado só p/ frequência)

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(15); // dia fixo no meio do mês, evita problemas de overflow
  return d;
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_progress_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalId = regPersonal.body.user.id;

  const regAluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_progress_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  alunoId = regAluno.body.user.id;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_progress_aluno2@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });

  const loginPersonal = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_progress_personal@thunderafit.test", password: "SenhaSegura@123" });
  tokenPersonal = loginPersonal.body.accessToken;

  const loginAluno = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_progress_aluno@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno = loginAluno.body.accessToken;

  const loginAluno2 = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_progress_aluno2@thunderafit.test", password: "SenhaSegura@123" });
  tokenAluno2 = loginAluno2.body.accessToken;

  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId });

  const exercises = await prisma.exercise.findMany({ orderBy: { name: "asc" }, take: 3 });
  exerciseAId = exercises[0].id;
  exerciseBId = exercises[1].id;
  exerciseCId = exercises[2].id;

  const workoutRes = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId, name: "Treino Progress A", letter: "A" });
  workoutId = workoutRes.body.workout.id;

  const otherWorkoutRes = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId, name: "Treino Progress B", letter: "B" });
  otherWorkoutId = otherWorkoutRes.body.workout.id;

  const weA = await supertest(server.server)
    .post(`/api/workouts/${workoutId}/exercises`)
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ exerciseId: exerciseAId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
  workoutExerciseAId = weA.body.workoutExercise.id;

  // exercício C é prescrito mas NUNCA recebe log — usado para confirmar que
  // GET /api/progress/exercises só lista exercícios com pelo menos 1 série.
  await supertest(server.server)
    .post(`/api/workouts/${workoutId}/exercises`)
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ exerciseId: exerciseCId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 2 });

  // Exercício B (não A) neste segundo treino — usado só para o teste de
  // frequência; se fosse o mesmo exercício A, contaminaria o teste de
  // load-history do exercício A com um 3º dia indesejado.
  const weA2 = await supertest(server.server)
    .post(`/api/workouts/${otherWorkoutId}/exercises`)
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ exerciseId: exerciseBId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
  workoutExerciseAId2 = weA2.body.workoutExercise.id;

  // --- Logs de carga (exercício A), 2 dias distintos, para testar agregação por dia ---
  // Dia mais antigo (3 dias atrás): pico de 60kg
  await prisma.setLog.create({
    data: { workoutExerciseId: workoutExerciseAId, setNumber: 1, repsDone: 10, weightKg: 55, loggedAt: daysAgo(3) },
  });
  await prisma.setLog.create({
    data: { workoutExerciseId: workoutExerciseAId, setNumber: 2, repsDone: 8, weightKg: 60, loggedAt: daysAgo(3) },
  });
  // Dia mais recente (hoje): pico de 65kg — deve gerar +8.33% vs 60kg anterior
  await prisma.setLog.create({
    data: { workoutExerciseId: workoutExerciseAId, setNumber: 1, repsDone: 9, weightKg: 62, loggedAt: daysAgo(0) },
  });
  await prisma.setLog.create({
    data: { workoutExerciseId: workoutExerciseAId, setNumber: 2, repsDone: 7, weightKg: 65, loggedAt: daysAgo(0) },
  });

  // --- Logs de frequência: 1 treino no mês atual, 1 treino 2 meses atrás ---
  await prisma.setLog.create({
    data: { workoutExerciseId: workoutExerciseAId2, setNumber: 1, repsDone: 10, weightKg: 40, loggedAt: monthsAgo(2) },
  });
});

afterAll(async () => {
  await prisma.setLog.deleteMany({
    where: { workoutExerciseId: { in: [workoutExerciseAId, workoutExerciseAId2] } },
  });
  await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: [workoutId, otherWorkoutId] } } });
  await prisma.workout.deleteMany({ where: { personalId } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_progress_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("GET /api/progress/exercises", () => {
  it("lista só os exercícios A e B (com pelo menos 1 série registrada), não o C", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/exercises")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    const ids = r.body.exercises.map((e: any) => e.id);
    expect(ids).toContain(exerciseAId);
    expect(ids).toContain(exerciseBId);
    expect(ids).not.toContain(exerciseCId);
  });

  // Fase 29: PERSONAL passou a poder ver a evolução de um aluno VINCULADO,
  // desde que passe ?alunoId= explicitamente — sem isso, ainda é rejeitado
  // (400, não mais 403, já que agora existe um jeito válido de pedir).
  it("retorna 400 para um PERSONAL sem alunoId", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/exercises")
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(400);
  });

  it("PERSONAL com alunoId de um aluno VINCULADO recebe 200 com os exercícios do aluno", async () => {
    const r = await supertest(server.server)
      .get(`/api/progress/exercises?alunoId=${alunoId}`)
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(200);
    const ids = r.body.exercises.map((e: any) => e.id);
    expect(ids).toContain(exerciseAId);
  });

  it("PERSONAL com alunoId de um aluno NÃO vinculado recebe 403 (IDOR fechado)", async () => {
    const outroAluno = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "test_progress_naovinc@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
    const r = await supertest(server.server)
      .get(`/api/progress/exercises?alunoId=${outroAluno.body.user.id}`)
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(403);
    await prisma.user.deleteMany({ where: { email: "test_progress_naovinc@thunderafit.test" } });
  });
});

describe("GET /api/progress/load-history", () => {
  it("retorna 400 sem exerciseId", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/load-history")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(400);
  });

  it("agrega o pico de carga por dia e calcula a variação percentual", async () => {
    const r = await supertest(server.server)
      .get(`/api/progress/load-history?exerciseId=${exerciseAId}`)
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.history).toHaveLength(2);
    expect(r.body.history[0].maxWeightKg).toBe(60);
    expect(r.body.history[1].maxWeightKg).toBe(65);
    expect(r.body.percentChangeVsPrevious).toBeCloseTo(8.33, 1);
  });

  it("retorna histórico vazio e variação nula para um aluno sem logs", async () => {
    const r = await supertest(server.server)
      .get(`/api/progress/load-history?exerciseId=${exerciseAId}`)
      .set("Authorization", `Bearer ${tokenAluno2}`);
    expect(r.status).toBe(200);
    expect(r.body.history).toHaveLength(0);
    expect(r.body.percentChangeVsPrevious).toBeNull();
  });
});

describe("GET /api/progress/frequency", () => {
  it("conta os treinos distintos por mês no período padrão (6m)", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/frequency")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.period).toBe("6m");
    expect(r.body.months).toHaveLength(6);
    expect(r.body.totalWorkouts).toBe(2); // workoutId (2x hoje/3d atrás) + otherWorkoutId (2 meses atrás)

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const currentMonthEntry = r.body.months.find((m: any) => m.month === currentMonthKey);
    expect(currentMonthEntry.workoutCount).toBe(1);
  });

  it("aceita period customizado (ex: 3m)", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/frequency?period=3m")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.period).toBe("3m");
    expect(r.body.months).toHaveLength(3);
  });
});

describe("GET /api/progress/weekly-summary (Fase 33.4)", () => {
  it("agrega volume da semana e dias ativos a partir dos logs existentes (hoje + 3 dias atrás)", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/weekly-summary")
      .set("Authorization", `Bearer ${tokenAluno}`);
    expect(r.status).toBe(200);
    expect(r.body.days).toHaveLength(7);

    // Volume = soma de weightKg*repsDone dos logs de hoje e 3 dias atrás
    // (55*10 + 60*8) + (62*9 + 65*7) = 1030 + 1013 = 2043
    expect(r.body.volumeKg).toBe(2043);
    // 4 séries no total na janela de 7 dias (2 hoje + 2 há 3 dias).
    expect(r.body.setsThisWeek).toBe(4);

    // Hoje tem log → sequência conta pelo menos o dia de hoje. Ontem não tem
    // log (só hoje e 3 dias atrás), então a sequência para em 1.
    expect(r.body.streakDays).toBe(1);

    const today = r.body.days[r.body.days.length - 1];
    expect(today.active).toBe(true);
    const threeDaysAgoKey = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const threeDaysAgoEntry = r.body.days.find((d: any) => d.date === threeDaysAgoKey);
    expect(threeDaysAgoEntry.active).toBe(true);
  });

  it("aluno sem nenhum log recebe tudo zerado, sem erro", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/weekly-summary")
      .set("Authorization", `Bearer ${tokenAluno2}`);
    expect(r.status).toBe(200);
    expect(r.body.volumeKg).toBe(0);
    expect(r.body.setsThisWeek).toBe(0);
    expect(r.body.streakDays).toBe(0);
    expect(r.body.days.every((d: any) => d.active === false)).toBe(true);
  });

  it("retorna 400 para um PERSONAL sem alunoId", async () => {
    const r = await supertest(server.server)
      .get("/api/progress/weekly-summary")
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(r.status).toBe(400);
  });
});
