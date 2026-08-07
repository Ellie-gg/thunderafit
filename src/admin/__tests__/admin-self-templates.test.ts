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

  // C10 (auditoria 2026-07-31): único handler de escrita do domínio sem
  // validação nenhuma do corpo — negativos/zero eram gravados sem reclamar,
  // e um exerciseId inexistente só estourava a FK do Prisma (500 opaco).
  it("C10: order negativo retorna 400 (antes era gravado como #-1)", async () => {
    const template = await supertest(server.server)
      .get("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`);
    const tpl = template.body.programs.find((p: any) => p.id === templateId);
    const sessionId = tpl.workouts[0].id;

    const r = await supertest(server.server)
      .post(`/api/admin/self-templates/${templateId}/sessions/${sessionId}/exercises`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ exerciseId, sets: 3, repsRange: "8-12", restSeconds: 60, order: -1 });
    expect(r.status).toBe(400);
  });

  it("C10: exerciseId inexistente retorna 404 (antes era 500 por violação de FK)", async () => {
    const template = await supertest(server.server)
      .get("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`);
    const tpl = template.body.programs.find((p: any) => p.id === templateId);
    const sessionId = tpl.workouts[0].id;

    const r = await supertest(server.server)
      .post(`/api/admin/self-templates/${templateId}/sessions/${sessionId}/exercises`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ exerciseId: "id-que-nao-existe", sets: 3, repsRange: "8-12", restSeconds: 60, order: 2 });
    expect(r.status).toBe(404);
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
    // C11 (auditoria 2026-07-31): a mensagem tinha esquecido "PRONTOS" (uma
    // 4ª categoria adicionada depois) — agora é derivada da própria lista
    // de categorias válidas, nunca mais dessincroniza.
    expect(r.body.error).toContain("PRONTOS");
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

describe("Fase 55.2 — admin edita nome PT + tradução EN/ES do template e da sessão", () => {
  let templateId55: string;
  let sessionId55: string;

  beforeAll(async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Template SELF Teste 55.2", sessionScheme: "LETTER" });
    templateId55 = created.body.program.id;

    const session = await supertest(server.server)
      .post(`/api/admin/self-templates/${templateId55}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ letter: "A" });
    sessionId55 = session.body.session.id;
  });

  // O nome muda ao longo destes testes (edição é o próprio objetivo), então
  // `cleanupTestPrograms` (filtro por prefixo do nome ORIGINAL) não pegaria
  // mais este template no afterAll global — apaga por id explicitamente
  // aqui (cascata manual, mesma ordem de cleanupTestPrograms).
  afterAll(async () => {
    await prisma.workoutExercise.deleteMany({ where: { workoutId: sessionId55 } });
    await prisma.workout.deleteMany({ where: { programId: templateId55 } });
    await prisma.workoutProgram.deleteMany({ where: { id: templateId55 } });
  });

  it("PERSONAL não pode editar o nome do template (403)", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Hackeado" });
    expect(r.status).toBe(403);
  });

  it("ADMIN edita o nome PT + EN/ES do template", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Full Body Editado", nameEN: "Full Body Edited", nameES: "Full Body Editado ES" });
    expect(r.status).toBe(200);
    expect(r.body.program.name).toBe("Full Body Editado");
    expect(r.body.program.translations).toEqual({ EN: "Full Body Edited", ES: "Full Body Editado ES" });
  });

  it("ADMIN edita só o nome PT (sem mandar EN/ES) — tradução já existente não é apagada", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Full Body Editado de Novo" });
    expect(r.status).toBe(200);
    expect(r.body.program.name).toBe("Full Body Editado de Novo");
    expect(r.body.program.translations).toEqual({ EN: "Full Body Edited", ES: "Full Body Editado ES" });
  });

  it("ADMIN não pode salvar nome PT vazio (400)", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "   " });
    expect(r.status).toBe(400);
  });

  it("ADMIN edita o nome PT + EN/ES da sessão", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}/sessions/${sessionId55}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Peito Editado", nameEN: "Chest Edited", nameES: "Pecho Editado" });
    expect(r.status).toBe(200);
    const editedSession = r.body.program.workouts.find((w: any) => w.id === sessionId55);
    expect(editedSession.name).toBe("Peito Editado");
    expect(editedSession.translations).toEqual({ EN: "Chest Edited", ES: "Pecho Editado" });
  });

  it("GET do template devolve as traduções salvas", async () => {
    const r = await supertest(server.server)
      .get(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.program.translations).toEqual({ EN: "Full Body Edited", ES: "Full Body Editado ES" });
  });

  it("Fase 59: ADMIN define a descrição (Foco) em PT + EN/ES do template", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Full Body Editado de Novo",
        description: "Foco em força e hipertrofia geral.",
        descriptionEN: "Focus on strength and general hypertrophy.",
        descriptionES: "Enfoque en fuerza e hipertrofia general.",
      });
    expect(r.status).toBe(200);
    expect(r.body.program.description).toBe("Foco em força e hipertrofia geral.");
    expect(r.body.program.translationDescriptions).toEqual({
      EN: "Focus on strength and general hypertrophy.",
      ES: "Enfoque en fuerza e hipertrofia general.",
    });
    // O nome traduzido salvo antes não pode ter sido sobrescrito pelo nome
    // em PT só porque esta chamada não reenviou nameEN/nameES.
    expect(r.body.program.translations).toEqual({ EN: "Full Body Edited", ES: "Full Body Editado ES" });
  });

  it("Fase 59: enviar description vazia limpa a descrição em PT", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${templateId55}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Full Body Editado de Novo", description: "" });
    expect(r.status).toBe(200);
    expect(r.body.program.description).toBeNull();
  });
});

describe("Fase 62 — mesma tela de admin também cura templates PERSONAL_CATALOG (Templates Básico do Personal)", () => {
  let catalogTemplateId: string;

  afterAll(async () => {
    if (catalogTemplateId) {
      const workouts = await prisma.workout.findMany({
        where: { programId: catalogTemplateId },
        select: { id: true },
      });
      await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: workouts.map((w) => w.id) } } });
      await prisma.workout.deleteMany({ where: { programId: catalogTemplateId } });
      await prisma.workoutProgram.delete({ where: { id: catalogTemplateId } });
    }
  });

  it("ADMIN cria um template com origin: PERSONAL_CATALOG (não SELF)", async () => {
    const r = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Fase 62 — Básico Full Body", origin: "PERSONAL_CATALOG" });
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("PERSONAL_CATALOG");
    expect(r.body.program.personalId).toBeNull();
    expect(r.body.program.isTemplate).toBe(true);
    catalogTemplateId = r.body.program.id;
  });

  it("GET /api/admin/self-templates?origin=SELF não lista o template PERSONAL_CATALOG", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/self-templates?origin=SELF")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.some((p: any) => p.id === catalogTemplateId)).toBe(false);
  });

  it("GET /api/admin/self-templates?origin=PERSONAL_CATALOG lista o template", async () => {
    const r = await supertest(server.server)
      .get("/api/admin/self-templates?origin=PERSONAL_CATALOG")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.some((p: any) => p.id === catalogTemplateId)).toBe(true);
  });

  it("GET /api/workout-programs/self-templates (catálogo do aluno) NUNCA lista um template PERSONAL_CATALOG", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs/self-templates")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.some((p: any) => p.id === catalogTemplateId)).toBe(false);
  });

  it("ADMIN ainda consegue editar sessões/exercícios de um template PERSONAL_CATALOG pelo mesmo CRUD", async () => {
    const s = await supertest(server.server)
      .post(`/api/admin/self-templates/${catalogTemplateId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ letter: "A" });
    expect(s.status).toBe(201);
  });

  it("PUT .../tags rejeita um template PERSONAL_CATALOG (400) — tags só fazem sentido em SELF", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${catalogTemplateId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["EXPRESS"] });
    expect(r.status).toBe(400);
  });
});

describe("Fase 63 — tags de filtro rápido (chips) em templates SELF", () => {
  let taggedTemplateId: string;

  it("ADMIN define múltiplas tags num template SELF", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Fase 63 — Treino com Tags" });
    taggedTemplateId = created.body.program.id;
    expect(created.body.program.tags).toEqual([]);

    // A2 (auditoria 2026-08-06): `listSelfTemplates` (catálogo do aluno) passou
    // a filtrar templates SEM nenhuma sessão — eles apareciam como cards
    // aplicáveis durante toda a curadoria do admin, e aplicar um deles
    // substituía o treino real do aluno por um programa vazio. Este fixture
    // precisa de 1 sessão pra representar um template curado de verdade e
    // continuar visível no catálogo.
    await supertest(server.server)
      .post(`/api/admin/self-templates/${taggedTemplateId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Sessão A", letter: "A" });

    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${taggedTemplateId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["FEMININO", "HIPERTROFIA"] });
    expect(r.status).toBe(200);
    expect(r.body.program.tags.sort()).toEqual(["FEMININO", "HIPERTROFIA"]);
  });

  it("substituir as tags troca a lista inteira (não soma)", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${taggedTemplateId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["EXPRESS"] });
    expect(r.status).toBe(200);
    expect(r.body.program.tags).toEqual(["EXPRESS"]);
  });

  it("lista vazia limpa todas as tags", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${taggedTemplateId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: [] });
    expect(r.status).toBe(200);
    expect(r.body.program.tags).toEqual([]);
  });

  it("rejeita uma tag inválida (400)", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${taggedTemplateId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["NAO_EXISTE"] });
    expect(r.status).toBe(400);
  });

  it("GET /api/workout-programs/self-templates (catálogo do aluno) devolve as tags do template", async () => {
    await supertest(server.server)
      .put(`/api/admin/self-templates/${taggedTemplateId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["DEFINICAO"] });

    const r = await supertest(server.server)
      .get("/api/workout-programs/self-templates")
      .set("Authorization", `Bearer ${alunoToken}`);
    const tpl = r.body.programs.find((p: any) => p.id === taggedTemplateId);
    expect(tpl.tags).toEqual(["DEFINICAO"]);
  });

  it("PERSONAL não pode definir tags (403)", async () => {
    const r = await supertest(server.server)
      .put(`/api/admin/self-templates/${taggedTemplateId}/tags`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ tags: ["EXPRESS"] });
    expect(r.status).toBe(403);
  });
});

// A2 (auditoria 2026-08-06): template SELF sem nenhuma sessão era um card
// aplicável no catálogo do aluno. `createSelfTemplate` cria o programa e as
// sessões vêm depois, em chamadas separadas — durante toda a curadoria o
// template já estava exposto. Aplicar um deles SUBSTITUI o treino pessoal
// ativo, apagando séries/exercícios/sessões, devolvendo um programa vazio sem
// desfazer. Defesa em 2 camadas: filtro na listagem + recusa no apply (pra
// fechar a chamada direta de API, que o filtro não cobre).
describe("Auditoria 2026-08-06, A2 — template SELF vazio não é ofertado nem aplicável", () => {
  let vazioId: string;

  beforeAll(async () => {
    const created = await supertest(server.server)
      .post("/api/admin/self-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "A2 — template recém-criado sem sessões" });
    vazioId = created.body.program.id;
  });

  afterAll(async () => {
    // `Workout.programId` NÃO tem cascade — o 3º teste adiciona uma sessão,
    // então apagar o programa direto viola a FK. Mesma ordem usada por
    // `cleanupTestPrograms` no topo do arquivo.
    await prisma.workout.deleteMany({ where: { programId: vazioId } });
    await prisma.workoutProgram.deleteMany({ where: { id: vazioId } });
  });

  it("não aparece no catálogo do aluno enquanto não tiver sessão", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs/self-templates")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.find((p: any) => p.id === vazioId)).toBeUndefined();
  });

  it("recusa o apply direto por API com 409, sem tocar no treino do aluno", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${vazioId}/apply-self-template`)
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(409);
    // Nada foi copiado pro aluno.
    const copias = await prisma.workoutProgram.count({
      where: { alunoId: alunoId, origin: "SELF", isTemplate: false, name: "A2 — template recém-criado sem sessões" },
    });
    expect(copias).toBe(0);
  });

  it("passa a aparecer no catálogo depois de ganhar a 1ª sessão", async () => {
    await supertest(server.server)
      .post(`/api/admin/self-templates/${vazioId}/sessions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Sessão A", letter: "A" });

    const r = await supertest(server.server)
      .get("/api/workout-programs/self-templates")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.body.programs.find((p: any) => p.id === vazioId)).toBeDefined();
  });
});
