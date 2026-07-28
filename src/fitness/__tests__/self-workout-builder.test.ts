import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";

// Fase 85 — Aluno Premium monta/edita o próprio treino do zero.
const TEST_EMAILS = [
  "swb_aluno_premium@thunderafit.test",
  "swb_aluno_sem_premium@thunderafit.test",
  "swb_personal@thunderafit.test",
  "swb_aluno_prescrito@thunderafit.test",
];

let premiumAlunoToken: string;
let premiumAlunoId: string;
let semPremiumToken: string;
let semPremiumId: string;
let personalToken: string;
let personalId: string;
let alunoPrescritoId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  const regPremium = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "swb_aluno_premium@thunderafit.test", password: pw, role: "ALUNO" });
  premiumAlunoId = regPremium.body.user.id;
  premiumAlunoToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "swb_aluno_premium@thunderafit.test", password: pw })
  ).body.accessToken;
  // Concede acesso Premium de verdade via o mesmo endpoint real do teste grátis.
  await supertest(server.server)
    .post("/api/billing/aluno/trial")
    .set("Authorization", `Bearer ${premiumAlunoToken}`);

  const regSemPremium = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "swb_aluno_sem_premium@thunderafit.test", password: pw, role: "ALUNO" });
  semPremiumId = regSemPremium.body.user.id;
  semPremiumToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "swb_aluno_sem_premium@thunderafit.test", password: pw })
  ).body.accessToken;

  const regPersonal = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "swb_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalId = regPersonal.body.user.id;
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "swb_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  const regPrescrito = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "swb_aluno_prescrito@thunderafit.test", password: pw, role: "ALUNO" });
  alunoPrescritoId = regPrescrito.body.user.id;
}, 30000);

afterAll(async () => {
  await prisma.workoutExercise.deleteMany({ where: { workout: { program: { alunoId: { in: [premiumAlunoId, semPremiumId, alunoPrescritoId] } } } } });
  await prisma.workout.deleteMany({ where: { program: { alunoId: { in: [premiumAlunoId, semPremiumId, alunoPrescritoId] } } } });
  await prisma.workoutProgram.deleteMany({ where: { alunoId: { in: [premiumAlunoId, semPremiumId, alunoPrescritoId] } } });
  await prisma.workoutExercise.deleteMany({ where: { workout: { personalId } } });
  await prisma.workout.deleteMany({ where: { personalId } });
  await prisma.workoutProgram.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 85 — POST /api/workout-programs/self (montar treino do zero)", () => {
  it("PERSONAL não pode montar um treino de aluno (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Meu treino" });
    expect(r.status).toBe(403);
  });

  it("ALUNO sem Premium recebe 402 PREMIUM_REQUIRED", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${semPremiumToken}`)
      .send({ name: "Meu treino" });
    expect(r.status).toBe(402);
    expect(r.body.code).toBe("PREMIUM_REQUIRED");
  });

  it("nome vazio recebe 400", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ name: "   " });
    expect(r.status).toBe(400);
  });

  let programId: string;

  it("ALUNO Premium cria o próprio treino com sucesso (origin SELF, sem Personal)", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ name: "Treino de Força" });
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("SELF");
    expect(r.body.program.personalId).toBeNull();
    expect(r.body.program.alunoId).toBe(premiumAlunoId);
    expect(r.body.program.isTemplate).toBe(false);
    programId = r.body.program.id;
  });

  it("criar um 2º treino sem replace recebe 409 SELF_PROGRAM_EXISTS", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ name: "Outro treino" });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("SELF_PROGRAM_EXISTS");
    expect(r.body.existingProgramId).toBe(programId);
  });

  it("com replace:true, substitui o treino anterior", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ name: "Treino Substituto", replace: true });
    expect(r.status).toBe(201);
    expect(r.body.program.name).toBe("Treino Substituto");

    const gone = await prisma.workoutProgram.findUnique({ where: { id: programId } });
    expect(gone).toBeNull();
  });
});

describe("Fase 85 — POST /api/workout-programs/:id/self-sessions", () => {
  let selfProgramId: string;
  let personalProgramId: string;

  beforeAll(async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ name: "Treino com Sessões", replace: true });
    selfProgramId = r.body.program.id;

    const p = await prisma.workoutProgram.create({
      data: { personalId, origin: "PERSONAL", name: "Programa do Personal", isTemplate: true },
    });
    personalProgramId = p.id;
  });

  it("adiciona a sessão A com sucesso", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${selfProgramId}/self-sessions`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ letter: "A" });
    expect(r.status).toBe(201);
    expect(r.body.session.letter).toBe("A");
    expect(r.body.session.alunoId).toBe(premiumAlunoId);
    expect(r.body.session.personalId).toBeNull();
  });

  it("sessão duplicada (mesma letra) recebe 409", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${selfProgramId}/self-sessions`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ letter: "A" });
    expect(r.status).toBe(409);
  });

  it("aluno SEM Premium não pode adicionar sessão ao próprio treino (402)", async () => {
    const selfProgramSemPremium = await prisma.workoutProgram.create({
      data: { alunoId: semPremiumId, origin: "SELF", name: "Treino sem premium", isTemplate: false },
    });
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${selfProgramSemPremium.id}/self-sessions`)
      .set("Authorization", `Bearer ${semPremiumToken}`)
      .send({ letter: "A" });
    expect(r.status).toBe(402);
    expect(r.body.code).toBe("PREMIUM_REQUIRED");
    await prisma.workoutProgram.deleteMany({ where: { id: selfProgramSemPremium.id } });
  });

  it("aluno não pode adicionar sessão a um programa do Personal (403)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${personalProgramId}/self-sessions`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ letter: "B" });
    expect(r.status).toBe(403);
  });
});

describe("Fase 85 — exercícios do próprio treino (ALUNO): add/reorder/delete", () => {
  let selfProgramId: string;
  let sessionId: string;
  let exerciseId: string;
  let personalPrescribedWorkoutId: string;

  beforeAll(async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs/self")
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ name: "Treino com Exercícios", replace: true });
    selfProgramId = r.body.program.id;

    const s = await supertest(server.server)
      .post(`/api/workout-programs/${selfProgramId}/self-sessions`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ letter: "A" });
    sessionId = s.body.session.id;

    const ex = await prisma.exercise.findFirst({ orderBy: { name: "asc" } });
    exerciseId = ex!.id;

    // Mesmo vínculo exigido em qualquer outro teste que crie um treino
    // prescrito de verdade (POST /api/workouts é Personal-only).
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoPrescritoId });
    const w = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoPrescritoId, name: "Treino A", letter: "A" });
    personalPrescribedWorkoutId = w.body.workout.id;
  }, 20000);

  it("ALUNO adiciona um exercício ao próprio treino com sucesso", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${sessionId}/exercises`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
    expect(r.status).toBe(201);
  });

  it("ALUNO sem Premium recebe 402 ao tentar adicionar exercício ao próprio treino", async () => {
    const ownProgram = await prisma.workoutProgram.create({
      data: { alunoId: semPremiumId, origin: "SELF", name: "Treino sem premium 2", isTemplate: false },
    });
    const ownSession = await prisma.workout.create({
      data: { programId: ownProgram.id, alunoId: semPremiumId, name: "A", letter: "A" },
    });
    const r = await supertest(server.server)
      .post(`/api/workouts/${ownSession.id}/exercises`)
      .set("Authorization", `Bearer ${semPremiumToken}`)
      .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
    expect(r.status).toBe(402);
    expect(r.body.code).toBe("PREMIUM_REQUIRED");
    await prisma.workout.deleteMany({ where: { id: ownSession.id } });
    await prisma.workoutProgram.deleteMany({ where: { id: ownProgram.id } });
  });

  it("ALUNO não pode adicionar exercício ao treino PRESCRITO pelo Personal (404 — não é dono)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${personalPrescribedWorkoutId}/exercises`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
    expect(r.status).toBe(404);
  });

  it("PERSONAL continua conseguindo prescrever exercício normalmente (comportamento inalterado)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${personalPrescribedWorkoutId}/exercises`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ exerciseId, sets: 4, repsRange: "10-15", restSeconds: 45, order: 1 });
    expect(r.status).toBe(201);
  });

  it("ALUNO reordena e remove um exercício do próprio treino", async () => {
    const exercisesList = await prisma.workoutExercise.findMany({ where: { workoutId: sessionId } });
    const ex2 = await prisma.exercise.findMany({ orderBy: { name: "asc" }, take: 2 });
    await supertest(server.server)
      .post(`/api/workouts/${sessionId}/exercises`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ exerciseId: ex2[1].id, sets: 3, repsRange: "8-12", restSeconds: 60, order: 2 });

    const moveRes = await supertest(server.server)
      .post(`/api/workouts/${sessionId}/exercises/${exercisesList[0].id}/move`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`)
      .send({ direction: "down" });
    expect(moveRes.status).toBe(200);

    const deleteRes = await supertest(server.server)
      .delete(`/api/workouts/${sessionId}/exercises/${exercisesList[0].id}`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`);
    expect(deleteRes.status).toBe(200);
  });
});

describe("Fase 85 — DELETE /api/workout-programs/:id (excluir o próprio treino, sem exigir Premium)", () => {
  it("ALUNO SEM Premium ainda consegue excluir um treino próprio já existente", async () => {
    const ownProgram = await prisma.workoutProgram.create({
      data: { alunoId: semPremiumId, origin: "SELF", name: "Treino a excluir", isTemplate: false },
    });
    const r = await supertest(server.server)
      .delete(`/api/workout-programs/${ownProgram.id}`)
      .set("Authorization", `Bearer ${semPremiumToken}`);
    expect(r.status).toBe(204);
    const gone = await prisma.workoutProgram.findUnique({ where: { id: ownProgram.id } });
    expect(gone).toBeNull();
  });

  it("ALUNO não pode excluir um programa do Personal (403)", async () => {
    const p = await prisma.workoutProgram.create({
      data: { personalId, origin: "PERSONAL", name: "Programa intocável", isTemplate: true },
    });
    const r = await supertest(server.server)
      .delete(`/api/workout-programs/${p.id}`)
      .set("Authorization", `Bearer ${premiumAlunoToken}`);
    expect(r.status).toBe(403);
    await prisma.workoutProgram.deleteMany({ where: { id: p.id } });
  });
});
