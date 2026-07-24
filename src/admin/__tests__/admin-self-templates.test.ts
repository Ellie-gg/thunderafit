import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let adminToken: string;
let personalToken: string;
let alunoToken: string;
let alunoId: string;
let exerciseId: string;
let templateId: string;

async function cleanupTestPrograms() {
  const programs = await prisma.workoutProgram.findMany({
    where: { name: { startsWith: "Template SELF Teste" } },
    select: { id: true },
  });
  const programIds = programs.map((p) => p.id);
  const workouts = await prisma.workout.findMany({
    where: { programId: { in: programIds } },
    select: { id: true },
  });
  const workoutIds = workouts.map((w) => w.id);
  await prisma.setLog.deleteMany({ where: { workoutExercise: { workoutId: { in: workoutIds } } } });
  await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: workoutIds } } });
  await prisma.workout.deleteMany({ where: { programId: { in: programIds } } });
  await prisma.workoutProgram.deleteMany({ where: { id: { in: programIds } } });
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "admin_self_tpl_root@thunderafit.test",
          "admin_self_tpl_personal@thunderafit.test",
          "admin_self_tpl_aluno@thunderafit.test",
        ],
      },
    },
  });
  await cleanupTestPrograms();

  await prisma.user.create({
    data: {
      email: "admin_self_tpl_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  adminToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_self_tpl_root@thunderafit.test", password: "SenhaSegura@123" })
  ).body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_self_tpl_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_self_tpl_personal@thunderafit.test", password: "SenhaSegura@123" })
  ).body.accessToken;

  const regAluno = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_self_tpl_aluno@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  alunoId = regAluno.body.user.id;
  alunoToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "admin_self_tpl_aluno@thunderafit.test", password: "SenhaSegura@123" })
  ).body.accessToken;

  const exercise = await prisma.exercise.findFirst({ orderBy: { name: "asc" } });
  exerciseId = exercise!.id;
});

afterAll(async () => {
  await cleanupTestPrograms();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "admin_self_tpl_root@thunderafit.test",
          "admin_self_tpl_personal@thunderafit.test",
          "admin_self_tpl_aluno@thunderafit.test",
        ],
      },
    },
  });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 34.5 — admin cura templates SELF (Meu treino pessoal)", () => {
  it("PERSONAL não pode acessar /api/admin/self-templates (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Template SELF Teste — Intruso" });
    expect(r.status).toBe(403);
  });

  it("ADMIN cria um template SELF (origin: SELF, personalId: null)", async () => {
    const r = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Full Body" });
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("SELF");
    expect(r.body.program.personalId).toBeNull();
    expect(r.body.program.isTemplate).toBe(true);
    templateId = r.body.program.id;
  });

  it("ADMIN adiciona uma sessão ao template", async () => {
    const r = await supertest(server.server)
      .post(`/api/admin/self-templates/${templateId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ letter: "A" });
    expect(r.status).toBe(201);
    expect(r.body.session.letter).toBe("A");
  });

  it("ADMIN adiciona um exercício à sessão", async () => {
    const template = await supertest(server.server)
      .get("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`);
    const tpl = template.body.programs.find((p: any) => p.id === templateId);
    const sessionId = tpl.workouts[0].id;

    const r = await supertest(server.server)
      .post(`/api/admin/self-templates/${templateId}/sessions/${sessionId}/exercises`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
    expect(r.status).toBe(201);
    expect(r.body.workoutExercise.exerciseId).toBe(exerciseId);
  });

  it("GET /api/workout-programs/self-templates (catálogo pro aluno) lista o template curado", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs/self-templates")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.some((p: any) => p.id === templateId)).toBe(true);
  });

  it("ALUNO aplica (copia) o template pra si mesmo — vira origin: SELF, alunoId preenchido, personalId null", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateId}/apply-self-template`)
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("SELF");
    expect(r.body.program.alunoId).toBe(alunoId);
    expect(r.body.program.personalId).toBeNull();
    expect(r.body.program.isTemplate).toBe(false);
    expect(r.body.program.workouts).toHaveLength(1);
    expect(r.body.program.workouts[0].exercises).toHaveLength(1);

    // Aparece na listagem normal do aluno, junto de programas prescritos.
    const list = await supertest(server.server)
      .get("/api/workout-programs")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(list.body.programs.some((p: any) => p.id === r.body.program.id)).toBe(true);
  });

  it("PERSONAL não pode aplicar um template SELF pelo endpoint de aplicar-self (403)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateId}/apply-self-template`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(403);
  });

  it("ADMIN exclui o template SELF", async () => {
    const r = await supertest(server.server)
      .delete(`/api/admin/self-templates/${templateId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(204);
    expect(await prisma.workoutProgram.findUnique({ where: { id: templateId } })).toBeNull();
  });
});
