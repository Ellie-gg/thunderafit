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
  // Ordem de dependência (setlog -> workoutExercise -> workout) — sem
  // apagar os SetLogs primeiro, `workoutExercise.deleteMany` viola a FK
  // sempre que algum teste registrou uma série e não limpou sozinho.
  const wes = await prisma.workoutExercise.findMany({ where: { workoutId }, select: { id: true } });
  await prisma.setLog.deleteMany({ where: { workoutExerciseId: { in: wes.map((w) => w.id) } } });
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

  // F4 (auditoria 2026-07-31): sets/restSeconds/order/repsRange nunca eram
  // validados numericamente — negativos/zero/vazio passavam direto pro banco.
  it.each([
    [{ sets: -3, repsRange: "8-12", restSeconds: 60, order: 1 }, "sets"],
    [{ sets: 0, repsRange: "8-12", restSeconds: 60, order: 1 }, "sets"],
    [{ sets: 3, repsRange: "8-12", restSeconds: -60, order: 1 }, "restSeconds"],
    [{ sets: 3, repsRange: "8-12", restSeconds: 60, order: -1 }, "order"],
    [{ sets: 3, repsRange: "   ", restSeconds: 60, order: 1 }, "repsRange"],
  ])("F4: %j é rejeitado com 400 mencionando %s", async (body, field) => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ exerciseId: exerciseIds[0], ...body });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain(field);
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

  // Perf (Grupo Y, item 99): o response schema novo (fast-json-stringify)
  // funciona como ALLOWLIST — um campo esquecido no schema some da resposta
  // em silêncio, sem erro nenhum. Este teste é a rede de segurança: compara
  // as CHAVES de cada nível aninhado contra a lista exata esperada (mapeada
  // campo a campo em workout-response-schemas.ts), pra pegar tanto um campo
  // que sumiu quanto um campo novo que ninguém lembrou de adicionar ao
  // schema no futuro.
  it("response schema não descarta nenhum campo esperado (allowlist check)", async () => {
    const before = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const workoutExerciseId = before.body.workout.exercises[0].id;

    // Registra e depois APAGA a série de teste — este workoutId é
    // compartilhado com o describe seguinte (`.../complete`), que espera
    // `setsLogged: 0` num treino ainda sem nenhuma série real.
    const logRes = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 20 });
    const setLogId = logRes.body.setLog.id;

    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);

    const workout = r.body.workout;
    expect(Object.keys(workout).sort()).toEqual(
      [
        "id",
        "programId",
        "personalId",
        "alunoId",
        "name",
        "letter",
        "lastCompletedAt",
        "createdAt",
        "updatedAt",
        "program",
        "exercises",
      ].sort()
    );
    expect(Object.keys(workout.program).sort()).toEqual(["origin", "sessionScheme"].sort());

    const we = workout.exercises.find((e: any) => e.id === workoutExerciseId);
    expect(Object.keys(we).sort()).toEqual(
      [
        "id",
        "workoutId",
        "exerciseId",
        "sets",
        "repsRange",
        "restSeconds",
        "order",
        "notes",
        "createdAt",
        "updatedAt",
        "exercise",
        "setLogs",
      ].sort()
    );
    expect(Object.keys(we.exercise).sort()).toEqual(
      [
        "id",
        "name",
        "muscleGroup",
        "equipment",
        "mediaUrl",
        "youtubeSupplementUrl",
        "mediaType",
        "description",
        "difficultyLevel",
        "isFeatured",
        "createdAt",
        "updatedAt",
      ].sort()
    );
    expect(we.setLogs).toHaveLength(1);
    expect(Object.keys(we.setLogs[0]).sort()).toEqual(
      ["id", "workoutExerciseId", "setNumber", "repsDone", "weightKg", "loggedAt"].sort()
    );

    await prisma.setLog.delete({ where: { id: setLogId } });
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

describe("Fase 112 — WorkoutSessionLog (duração real + RPE opcional)", () => {
  let sessionWorkoutId: string;

  beforeAll(async () => {
    const w = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Sessão fase 112", letter: "B" });
    sessionWorkoutId = w.body.workout.id;
  });

  afterAll(async () => {
    // WorkoutSessionLog tem onDelete: Cascade em Workout — apagar o Workout
    // já basta, sem precisar limpar a tabela nova separadamente.
    await prisma.workout.deleteMany({ where: { id: sessionWorkoutId } });
  });

  it("concluir com durationSeconds persiste o WorkoutSessionLog e devolve sessionLogId", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${sessionWorkoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ durationSeconds: 1800 });

    expect(r.status).toBe(200);
    expect(typeof r.body.summary.sessionLogId).toBe("string");

    const log = await prisma.workoutSessionLog.findUnique({
      where: { id: r.body.summary.sessionLogId },
    });
    expect(log).not.toBeNull();
    expect(log?.durationSeconds).toBe(1800);
    expect(log?.alunoId).toBe(vinculadoAlunoId);
    expect(log?.startedAt).not.toBeNull();
  });

  it("concluir sem durationSeconds ainda funciona (client mais antigo), sem duração persistida", async () => {
    const w = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Sessão fase 112 sem duração", letter: "C" });
    const noDurationWorkoutId = w.body.workout.id;

    const r = await supertest(server.server)
      .post(`/api/workouts/${noDurationWorkoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`);
    expect(r.status).toBe(200);

    const log = await prisma.workoutSessionLog.findUnique({
      where: { id: r.body.summary.sessionLogId },
    });
    expect(log?.durationSeconds).toBeNull();
    expect(log?.startedAt).toBeNull();

    await prisma.workout.deleteMany({ where: { id: noDurationWorkoutId } });
  });

  it("durationSeconds negativo recebe 400", async () => {
    const w = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Sessão fase 112 negativa", letter: "D" });
    const badWorkoutId = w.body.workout.id;

    const r = await supertest(server.server)
      .post(`/api/workouts/${badWorkoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ durationSeconds: -5 });
    expect(r.status).toBe(400);

    await prisma.workout.deleteMany({ where: { id: badWorkoutId } });
  });

  it("PATCH /api/workout-sessions/:sessionLogId/rpe grava o RPE do dono", async () => {
    const complete = await supertest(server.server)
      .post(`/api/workouts/${sessionWorkoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ durationSeconds: 2400 });
    const sessionLogId = complete.body.summary.sessionLogId;

    const r = await supertest(server.server)
      .patch(`/api/workout-sessions/${sessionLogId}/rpe`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ rpe: 7 });
    expect(r.status).toBe(200);
    expect(r.body.sessionLog.rpe).toBe(7);
  });

  it("RPE fora de 0-10 recebe 400", async () => {
    const complete = await supertest(server.server)
      .post(`/api/workouts/${sessionWorkoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ durationSeconds: 1200 });
    const sessionLogId = complete.body.summary.sessionLogId;

    const r = await supertest(server.server)
      .patch(`/api/workout-sessions/${sessionLogId}/rpe`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ rpe: 11 });
    expect(r.status).toBe(400);
  });

  it("outro aluno não consegue gravar RPE numa sessão que não é dele (404, não vaza existência)", async () => {
    const complete = await supertest(server.server)
      .post(`/api/workouts/${sessionWorkoutId}/complete`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ durationSeconds: 1500 });
    const sessionLogId = complete.body.summary.sessionLogId;

    const loginRes2 = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "test_workout_aluno2@thunderafit.test", password: "SenhaSegura@123" });

    const r = await supertest(server.server)
      .patch(`/api/workout-sessions/${sessionLogId}/rpe`)
      .set("Authorization", `Bearer ${loginRes2.body.accessToken}`)
      .send({ rpe: 5 });
    expect(r.status).toBe(404);
  });
});

describe("DELETE /api/workouts/:id/exercises/:exerciseId (Fase 65)", () => {
  // Treino próprio, isolado do `workoutId` compartilhado do resto do
  // arquivo — evita quebrar as asserções de contagem fixa (ex: "toHaveLength(3)")
  // dos blocos acima.
  let deletableWorkoutId: string;
  let exerciseAId: string;
  let exerciseBId: string;

  beforeAll(async () => {
    const w = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Treino Deletável", letter: "Z" });
    deletableWorkoutId = w.body.workout.id;

    const addA = await supertest(server.server)
      .post(`/api/workouts/${deletableWorkoutId}/exercises`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ exerciseId: exerciseIds[0], sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
    exerciseAId = addA.body.workoutExercise.id;

    const addB = await supertest(server.server)
      .post(`/api/workouts/${deletableWorkoutId}/exercises`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ exerciseId: exerciseIds[1], sets: 3, repsRange: "8-12", restSeconds: 60, order: 2 });
    exerciseBId = addB.body.workoutExercise.id;

    await supertest(server.server)
      .post(`/api/workouts/${deletableWorkoutId}/exercises/${exerciseAId}/logs`)
      .set("Authorization", `Bearer ${alunoAccessToken}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 40 });
  });

  it("aluno (não dono) não pode excluir — 404 (mesma semântica de posse do move/add)", async () => {
    const r = await supertest(server.server)
      .delete(`/api/workouts/${deletableWorkoutId}/exercises/${exerciseAId}`)
      .set("Authorization", `Bearer ${alunoAccessToken}`);
    expect(r.status).toBe(404);
  });

  it("exclui um exercício com séries já registradas — some da lista e as séries somem junto", async () => {
    const r = await supertest(server.server)
      .delete(`/api/workouts/${deletableWorkoutId}/exercises/${exerciseAId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.exercises.some((e: any) => e.id === exerciseAId)).toBe(false);
    expect(r.body.exercises.some((e: any) => e.id === exerciseBId)).toBe(true);

    const setLogs = await prisma.setLog.findMany({ where: { workoutExerciseId: exerciseAId } });
    expect(setLogs).toHaveLength(0);
  });

  it("excluir de novo o mesmo exercício (já apagado) retorna 404", async () => {
    const r = await supertest(server.server)
      .delete(`/api/workouts/${deletableWorkoutId}/exercises/${exerciseAId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(404);
  });

  it("excluir um exerciseId de outro treino (não pertence a este workoutId) retorna 404", async () => {
    const r = await supertest(server.server)
      .delete(`/api/workouts/${workoutId}/exercises/${exerciseBId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(r.status).toBe(404);
  });

  afterAll(async () => {
    // O afterAll global do arquivo só limpa o `workoutId` compartilhado —
    // este describe cria seu PRÓPRIO treino (deletableWorkoutId), então
    // limpa o que sobrou dele aqui mesmo (senão o `workout.deleteMany` global
    // por personalId falharia por FK: WorkoutExercise de exerciseB ainda
    // existe e referencia este workout).
    await prisma.setLog.deleteMany({ where: { workoutExerciseId: exerciseBId } });
    await prisma.workoutExercise.deleteMany({ where: { workoutId: deletableWorkoutId } });
  });
});

// Perf (Grupo Y, item 102) — mesmo cap defensivo aditivo de
// GET /api/workout-programs (ver workout-programs.test.ts), agora em
// GET /api/workouts. Personal dedicado com contagem exata — o `workoutId`
// compartilhado do arquivo não serve pra testar quantidade.
describe("Perf (Grupo Y, item 102) — page/pageSize opcionais em GET /api/workouts", () => {
  let pagPersonalId: string;
  let pagPersonalToken: string;
  let pagAlunoId: string;
  let seededIds: string[];

  beforeAll(async () => {
    const regP = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "test_workout_pag_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
    pagPersonalId = regP.body.user.id;
    pagPersonalToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "test_workout_pag_personal@thunderafit.test", password: "SenhaSegura@123" })
    ).body.accessToken;

    const regA = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "test_workout_pag_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
    pagAlunoId = regA.body.user.id;
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${pagPersonalToken}`)
      .send({ alunoId: pagAlunoId });

    // findAllByPersonal ordena por createdAt ASC (mais antigo primeiro) —
    // diferente de listByPersonal (programas), que ordena DESC. Timestamps
    // espaçados manualmente pela mesma razão do teste equivalente em
    // workout-programs.test.ts: evitar empate de milissegundo entre creates
    // em sequência.
    seededIds = [];
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      const program = await prisma.workoutProgram.create({
        data: { personalId: pagPersonalId, alunoId: pagAlunoId, name: `Programa Pag ${i}`, isTemplate: false },
      });
      const w = await prisma.workout.create({
        data: {
          programId: program.id,
          personalId: pagPersonalId,
          alunoId: pagAlunoId,
          name: `Treino Pag ${i}`,
          letter: "A",
          createdAt: new Date(base + i * 1000),
        },
      });
      seededIds.push(w.id);
    }
  });

  afterAll(async () => {
    const progs = await prisma.workoutProgram.findMany({
      where: { personalId: pagPersonalId },
      select: { id: true },
    });
    await prisma.workout.deleteMany({ where: { programId: { in: progs.map((p) => p.id) } } });
    await prisma.workoutProgram.deleteMany({ where: { personalId: pagPersonalId } });
    await prisma.clientRelation.deleteMany({ where: { personalId: pagPersonalId } });
    await prisma.user.deleteMany({
      where: { email: { in: ["test_workout_pag_personal@thunderafit.test", "test_workout_pag_aluno@thunderafit.test"] } },
    });
  });

  it("sem page/pageSize, devolve todos os 5 (comportamento de hoje preservado)", async () => {
    const r = await supertest(server.server)
      .get("/api/workouts")
      .set("Authorization", `Bearer ${pagPersonalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts).toHaveLength(5);
  });

  it("?pageSize=2 devolve só os 2 mais antigos (orderBy createdAt asc preservado)", async () => {
    const r = await supertest(server.server)
      .get("/api/workouts?pageSize=2")
      .set("Authorization", `Bearer ${pagPersonalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts.map((w: any) => w.id)).toEqual([seededIds[0], seededIds[1]]);
  });

  it("?pageSize=2&page=2 devolve a próxima dupla, não repete a primeira página", async () => {
    const r = await supertest(server.server)
      .get("/api/workouts?pageSize=2&page=2")
      .set("Authorization", `Bearer ${pagPersonalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.workouts.map((w: any) => w.id)).toEqual([seededIds[2], seededIds[3]]);
  });
});
