import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

// Fase 52: mesmo motivo do mock em admin-exercise-media.test.ts — o SDK real
// do @google-cloud/storage exige bucket/credenciais de verdade; aqui só
// testamos validação + roteamento do banner, não o SDK do Google.
jest.mock("../../lib/storage", () => ({
  uploadTemplateBanner: jest.fn().mockResolvedValue(
    "https://storage.googleapis.com/thunderafit-test-bucket/banners/fake-test-banner.png"
  ),
}));

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

describe("Fase 52 — categoria + banner do template SELF", () => {
  // 1x1 PNG vermelho válido (base64), usado só pra testar o caminho de
  // sucesso do upload — não precisa parecer um banner de verdade.
  const TINY_PNG_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  it("ADMIN cria template SELF sem category → default GERAL", async () => {
    const r = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Sem Categoria" });
    expect(r.status).toBe(201);
    expect(r.body.program.category).toBe("GERAL");
    expect(r.body.program.bannerImageUrl).toBeNull();
  });

  it("ADMIN cria template SELF com category HOME", async () => {
    const r = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Casa", category: "HOME" });
    expect(r.status).toBe(201);
    expect(r.body.program.category).toBe("HOME");
  });

  it("ADMIN cria template SELF com category inválida → 400", async () => {
    const r = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Categoria Inválida", category: "VIP" });
    expect(r.status).toBe(400);
  });

  it("PERSONAL não pode subir banner de template SELF (403)", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Banner Auth", category: "PREMIUM" });
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${created.body.program.id}/banner`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ bannerDataUrl: TINY_PNG_DATA_URL });
    expect(r.status).toBe(403);
  });

  it("ADMIN sobe um banner PNG válido pro template", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Banner OK", category: "PREMIUM" });
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${created.body.program.id}/banner`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bannerDataUrl: TINY_PNG_DATA_URL });
    expect(r.status).toBe(200);
    expect(typeof r.body.program.bannerImageUrl).toBe("string");
    expect(r.body.program.bannerImageUrl).toMatch(/^https:\/\//);
  });

  it("ADMIN rejeita banner em formato inválido (não é PNG/JPEG/WebP)", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Banner Formato Errado" });
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${created.body.program.id}/banner`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bannerDataUrl: "data:text/plain;base64,aGVsbG8=" });
    expect(r.status).toBe(400);
  });

  it("ADMIN remove o banner (bannerDataUrl: null) — volta pro fallback estático", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Banner Remove", category: "HOME" });
    await supertest(server.server)
      .put(`/api/admin/self-templates/${created.body.program.id}/banner`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bannerDataUrl: TINY_PNG_DATA_URL });
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${created.body.program.id}/banner`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bannerDataUrl: null });
    expect(r.status).toBe(200);
    expect(r.body.program.bannerImageUrl).toBeNull();
  });
});

describe("Fase 52 — 1 treino pessoal ativo por vez (substituição)", () => {
  let templateAId: string;
  let templateBId: string;

  beforeAll(async () => {
    // O describe "Fase 34.5" acima já aplicou um template SELF pra este
    // mesmo aluno (sem limpar a instância aplicada, só o template-fonte) —
    // limpa antes de testar a invariante pra começar de um estado "sem
    // treino pessoal ativo" de verdade. Cascade manual (sem onDelete:
    // Cascade no schema, mesmo motivo documentado em workout-programs.
    // repository.ts#deleteProgram): sessões/exercícios/séries antes do
    // programa.
    const leftoverPrograms = await prisma.workoutProgram.findMany({
      where: { alunoId, origin: "SELF", isTemplate: false },
      select: { id: true },
    });
    const leftoverProgramIds = leftoverPrograms.map((p) => p.id);
    const leftoverWorkouts = await prisma.workout.findMany({
      where: { programId: { in: leftoverProgramIds } },
      select: { id: true },
    });
    const leftoverWorkoutIds = leftoverWorkouts.map((w) => w.id);
    await prisma.setLog.deleteMany({ where: { workoutExercise: { workoutId: { in: leftoverWorkoutIds } } } });
    await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: leftoverWorkoutIds } } });
    await prisma.workout.deleteMany({ where: { programId: { in: leftoverProgramIds } } });
    await prisma.workoutProgram.deleteMany({ where: { id: { in: leftoverProgramIds } } });

    const a = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Substituição A" });
    templateAId = a.body.program.id;
    await supertest(server.server)
      .post(`/api/admin/self-templates/${templateAId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ letter: "A" });

    const b = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste — Substituição B" });
    templateBId = b.body.program.id;
    await supertest(server.server)
      .post(`/api/admin/self-templates/${templateBId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ letter: "A" });
  });

  it("1ª aplicação funciona normalmente (sem treino pessoal ativo ainda)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateAId}/apply-self-template`)
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(201);
  });

  it("aplicar um 2º template sem replace → 409 com code SELF_PROGRAM_EXISTS", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateBId}/apply-self-template`)
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("SELF_PROGRAM_EXISTS");
    expect(r.body.existingProgramName).toBe("Template SELF Teste — Substituição A");
    expect(typeof r.body.existingProgramId).toBe("string");
  });

  it("aplicar com replace: true substitui — o anterior é apagado e o novo vira o ativo", async () => {
    const before = await supertest(server.server)
      .get("/api/workout-programs")
      .set("Authorization", `Bearer ${alunoToken}`);
    const previousId = before.body.programs.find(
      (p: any) => p.name === "Template SELF Teste — Substituição A"
    )?.id;
    expect(previousId).toBeTruthy();

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateBId}/apply-self-template`)
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ replace: true });
    expect(r.status).toBe(201);
    expect(r.body.program.name).toBe("Template SELF Teste — Substituição B");

    expect(await prisma.workoutProgram.findUnique({ where: { id: previousId } })).toBeNull();

    const after = await supertest(server.server)
      .get("/api/workout-programs")
      .set("Authorization", `Bearer ${alunoToken}`);
    const activeSelfPrograms = after.body.programs.filter(
      (p: any) => p.origin === "SELF" && !p.isTemplate
    );
    expect(activeSelfPrograms).toHaveLength(1);
    expect(activeSelfPrograms[0].name).toBe("Template SELF Teste — Substituição B");
  });
});
