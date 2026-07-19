import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let adminToken: string;
let personalToken: string;

const TEST_NAME_PREFIX = "Exercício Teste CRUD Fase 33";

async function cleanupTestExercises() {
  await prisma.exercise.deleteMany({ where: { name: { startsWith: TEST_NAME_PREFIX } } });
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["admin_crud_test_root@thunderafit.test", "admin_crud_test_personal@thunderafit.test"],
      },
    },
  });
  await cleanupTestExercises();

  await prisma.user.create({
    data: {
      email: "admin_crud_test_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  const adminLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_crud_test_root@thunderafit.test", password: "SenhaSegura@123" });
  adminToken = adminLogin.body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({
      email: "admin_crud_test_personal@thunderafit.test",
      password: "SenhaSegura@123",
      role: "PERSONAL",
    });
  const personalLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_crud_test_personal@thunderafit.test", password: "SenhaSegura@123" });
  personalToken = personalLogin.body.accessToken;
});

afterAll(async () => {
  await cleanupTestExercises();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["admin_crud_test_root@thunderafit.test", "admin_crud_test_personal@thunderafit.test"],
      },
    },
  });
  await server.close();
  await prisma.$disconnect();
});

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: `${TEST_NAME_PREFIX} — Base`,
    muscleGroup: "Peito",
    equipment: "Barra",
    description: "Descrição de teste.",
    difficultyLevel: "INTERMEDIARIO",
    ...overrides,
  };
}

describe("Fase 33 — POST /api/admin/exercises", () => {
  it("PERSONAL (não-admin) recebe 403", async () => {
    const res = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${personalToken}`)
      .send(validPayload());
    expect(res.status).toBe(403);
  });

  it("cria exercício com sucesso", async () => {
    const res = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Criar` }));
    expect(res.status).toBe(200);
    expect(res.body.exercise.name).toBe(`${TEST_NAME_PREFIX} — Criar`);
    expect(res.body.exercise.mediaType).toBe("YOUTUBE");
  });

  it("campo obrigatório ausente recebe 400", async () => {
    const res = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: undefined }));
    expect(res.status).toBe(400);
  });

  it("difficultyLevel inválido recebe 400", async () => {
    const res = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Dificuldade`, difficultyLevel: "LENDARIO" }));
    expect(res.status).toBe(400);
  });

  it("nome idêntico a um já existente recebe 409", async () => {
    const name = `${TEST_NAME_PREFIX} — Duplicado`;
    const first = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name }));
    expect(first.status).toBe(200);

    const second = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name }));
    expect(second.status).toBe(409);
  });

  it("nome parecido (variação de acento/espaço) sem confirmação retorna aviso, não cria", async () => {
    const baseName = `${TEST_NAME_PREFIX} — Similar Base`;
    await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: baseName }));

    const similarName = `${TEST_NAME_PREFIX}  — similar base`; // espaço duplo + caixa diferente
    const res = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: similarName }));

    expect(res.status).toBe(200);
    expect(res.body.warning).toBe("similar_name");
    expect(res.body.similarNames).toContain(baseName);
    expect(res.body.exercise).toBeUndefined();

    const notCreated = await prisma.exercise.findUnique({ where: { name: similarName } });
    expect(notCreated).toBeNull();
  });

  it("nome parecido COM confirmSimilarName=true cria mesmo assim", async () => {
    const baseName = `${TEST_NAME_PREFIX} — Confirma Base`;
    await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: baseName }));

    const similarName = `${TEST_NAME_PREFIX} — Confirma Basee`; // 1 char de diferença
    const res = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: similarName, confirmSimilarName: true }));

    expect(res.status).toBe(200);
    expect(res.body.exercise.name).toBe(similarName);
  });
});

describe("Fase 33 — PUT /api/admin/exercises/:id", () => {
  it("exercício inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .put("/api/admin/exercises/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Update 404` }));
    expect(res.status).toBe(404);
  });

  it("edita exercício com sucesso", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Antes de Editar` }));
    const id = created.body.exercise.id;

    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Depois de Editar` }));
    expect(res.status).toBe(200);
    expect(res.body.exercise.name).toBe(`${TEST_NAME_PREFIX} — Depois de Editar`);
  });
});

describe("Fase 33 — DELETE /api/admin/exercises/:id", () => {
  it("exercício inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .delete("/api/admin/exercises/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("exclui exercício sem prescrições com sucesso", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Pra Excluir` }));
    const id = created.body.exercise.id;

    const res = await supertest(server.server)
      .delete(`/api/admin/exercises/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const gone = await prisma.exercise.findUnique({ where: { id } });
    expect(gone).toBeNull();
  });

  it("exercício referenciado em uma prescrição recebe 409 e não é excluído", async () => {
    const created = await supertest(server.server)
      .post("/api/admin/exercises")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validPayload({ name: `${TEST_NAME_PREFIX} — Em Uso` }));
    const exerciseId = created.body.exercise.id;

    const personalUser = await prisma.user.findUnique({
      where: { email: "admin_crud_test_personal@thunderafit.test" },
    });
    const program = await prisma.workoutProgram.create({
      data: { personalId: personalUser!.id, name: "Programa Teste Fase 33", isTemplate: true },
    });
    const workout = await prisma.workout.create({
      data: {
        programId: program.id,
        personalId: personalUser!.id,
        name: "Treino Teste Fase 33",
        letter: "A",
      },
    });
    await prisma.workoutExercise.create({
      data: {
        workoutId: workout.id,
        exerciseId,
        sets: 3,
        repsRange: "8-12",
        restSeconds: 60,
        order: 1,
      },
    });

    const res = await supertest(server.server)
      .delete(`/api/admin/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(409);

    const stillThere = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    expect(stillThere).not.toBeNull();

    // limpeza manual (fora do cleanupTestExercises, que só olha o nome)
    await prisma.workoutExercise.deleteMany({ where: { workoutId: workout.id } });
    await prisma.workout.delete({ where: { id: workout.id } });
    await prisma.workoutProgram.delete({ where: { id: program.id } });
  });
});
