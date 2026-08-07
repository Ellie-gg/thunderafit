import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import { exerciseTranslationsRepository } from "../repository/exercise-translations.repository";

let server: import("fastify").FastifyInstance;
let personalToken: string;
let exerciseId: string;
let exerciseName: string;

// Fase 119: a suíte usa um exercício PRÓPRIO, criado aqui, em vez do 1º do
// catálogo real. Antes ela sequestrava `catalog.body.exercises[0]`, e isso
// tinha dois defeitos:
//
// 1. **Destruía dado semeado**: o `afterAll` fazia
//    `deleteMany({ exerciseId })`, apagando as traduções DE VERDADE daquele
//    exercício. A cobertura de tradução do banco local regredia a cada
//    `npm test` (observado: voltava de 0 pra 1 exercício sem tradução).
// 2. **Assumia que aquele exercício NÃO tinha tradução** — premissa que só
//    valia enquanto a cobertura do catálogo era incompleta. Ao fechar a última
//    lacuna (20 exercícios sem tradução em produção → 0), a premissa virou
//    falsa e 4 testes passaram a falhar: o de fallback recebia a tradução real
//    em vez do PT, e o `create()` batia na unique constraint.
//
// Com exercício próprio, a suíte controla 100% do estado de tradução, não
// depende da cobertura do catálogo e não mexe em nada real.
const EXERCICIO_TESTE = "ZZZ i18n Test Exercise (descartável)";

const pw = "SenhaSegura@123";

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "i18n_ex_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "i18n_ex_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  // Exercício descartável e SEM tradução, sob controle total da suíte.
  await prisma.exerciseTranslation.deleteMany({
    where: { exercise: { name: EXERCICIO_TESTE } },
  });
  await prisma.exercise.deleteMany({ where: { name: EXERCICIO_TESTE } });
  const criado = await prisma.exercise.create({
    data: {
      name: EXERCICIO_TESTE,
      muscleGroup: "Peito",
      equipment: "Peso Corporal",
      mediaUrl: "https://www.youtube.com/watch?v=IODxDxX7oi4",
      mediaType: "YOUTUBE",
      description: "Exercício criado por teste automatizado. Não deve aparecer em produção.",
      difficultyLevel: "INICIANTE",
    },
  });
  exerciseId = criado.id;
  exerciseName = criado.name;
  // O catálogo tem cache próprio (`exercises.repository.ts`) — sem isto, o
  // exercício recém-criado pode não aparecer em `GET /api/exercises`.
  exerciseTranslationsRepository.invalidateCache();
});

afterAll(async () => {
  await prisma.exerciseTranslation.deleteMany({ where: { exerciseId } });
  await prisma.workoutExercise.deleteMany({ where: { exerciseId } });
  await prisma.exercise.deleteMany({ where: { id: exerciseId } });
  exerciseTranslationsRepository.invalidateCache();
  await prisma.user.deleteMany({ where: { email: { contains: "i18n_ex_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("i18n — catálogo de exercícios com locale ativo (fallback pro PT)", () => {
  it("sem header x-locale retorna em português (comportamento inalterado)", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    const ex = r.body.exercises.find((e: any) => e.id === exerciseId);
    expect(ex.name).toBe(exerciseName);
  });

  it("x-locale: en SEM tradução cadastrada ainda cai pro nome em português (nunca vazio, nunca quebra)", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${personalToken}`)
      .set("x-locale", "en");
    expect(r.status).toBe(200);
    const ex = r.body.exercises.find((e: any) => e.id === exerciseId);
    expect(ex.name).toBe(exerciseName);
  });

  it("com tradução EN cadastrada, x-locale: en retorna o nome/categoria/descrição traduzidos", async () => {
    await prisma.exerciseTranslation.create({
      data: {
        exerciseId,
        locale: "EN",
        name: "Test Translated Name",
        muscleGroup: "Test Chest",
        description: "Test translated description.",
      },
    });
    // Escrita direta via Prisma (não passa pelo CRUD do admin) — precisa
    // invalidar o cache em memória de exercise-translations.repository.ts
    // manualmente, senão o teste abaixo vê o EN cacheado da chamada
    // anterior (sem esta tradução ainda).
    exerciseTranslationsRepository.invalidateCache();

    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${personalToken}`)
      .set("x-locale", "en");
    const ex = r.body.exercises.find((e: any) => e.id === exerciseId);
    expect(ex.name).toBe("Test Translated Name");
    expect(ex.muscleGroup).toBe("Test Chest");
    expect(ex.description).toBe("Test translated description.");

    // Outro exercício sem tradução própria continua em português — o
    // fallback é por exercício individual, não tudo-ou-nada.
    const other = r.body.exercises.find((e: any) => e.id !== exerciseId);
    expect(other.name).not.toBe("Test Translated Name");
  });

  it("x-locale: es (sem tradução ES cadastrada) cai pro português — fallback independente por locale", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${personalToken}`)
      .set("x-locale", "es");
    const ex = r.body.exercises.find((e: any) => e.id === exerciseId);
    expect(ex.name).toBe(exerciseName); // EN tem tradução, ES não — cada locale é independente
  });

  it("header x-locale desconhecido (não é pt/en/es) cai pro português, não quebra", async () => {
    const r = await supertest(server.server)
      .get("/api/exercises")
      .set("Authorization", `Bearer ${personalToken}`)
      .set("x-locale", "fr");
    expect(r.status).toBe(200);
    const ex = r.body.exercises.find((e: any) => e.id === exerciseId);
    expect(ex.name).toBe(exerciseName);
  });
});

describe("i18n — exercícios ANINHADOS em sessão/programa (getWorkout, getProgram)", () => {
  let programId: string;
  let sessionId: string;

  beforeAll(async () => {
    const program = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Programa i18n teste" });
    programId = program.body.program.id;

    const session = await supertest(server.server)
      .post(`/api/workout-programs/${programId}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });
    sessionId = session.body.session.id;

    await supertest(server.server)
      .post(`/api/workouts/${sessionId}/exercises`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
  });

  afterAll(async () => {
    await prisma.workoutExercise.deleteMany({ where: { workoutId: sessionId } });
    await prisma.workout.deleteMany({ where: { id: sessionId } });
    await prisma.workoutProgram.deleteMany({ where: { id: programId } });
  });

  it("GET /api/workouts/:id traduz o exercício aninhado (tela de execução) no locale ativo", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${sessionId}`)
      .set("Authorization", `Bearer ${personalToken}`)
      .set("x-locale", "en");
    expect(r.status).toBe(200);
    expect(r.body.workout.exercises[0].exercise.name).toBe("Test Translated Name");
  });

  it("GET /api/workout-programs/:id traduz os exercícios de todas as sessões no locale ativo", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs/${programId}`)
      .set("Authorization", `Bearer ${personalToken}`)
      .set("x-locale", "en");
    expect(r.status).toBe(200);
    const session = r.body.program.workouts.find((w: any) => w.id === sessionId);
    expect(session.exercises[0].exercise.name).toBe("Test Translated Name");
  });

  it("sem x-locale, os mesmos endpoints continuam em português", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${sessionId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.body.workout.exercises[0].exercise.name).toBe(exerciseName);
  });
});
