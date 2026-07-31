import supertest from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

// Fase 32: o SDK real do @google-cloud/storage exige credenciais/bucket de
// verdade — o que testamos aqui é a validação e o roteamento, não o SDK do
// Google (que já é testado pela própria Google). Mock troca a chamada real
// por uma URL fake determinística.
jest.mock("../../lib/storage", () => ({
  uploadExerciseMedia: jest.fn().mockResolvedValue(
    "https://storage.googleapis.com/thunderafit-test-bucket/exercises/fake-test-object.mp4"
  ),
}));

let server: import("fastify").FastifyInstance;
let adminToken: string;
let personalToken: string;
let exerciseId: string;

const TINY_BASE64 = Buffer.from("fake-media-bytes-for-test").toString("base64");

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  // Limpa dados de execuções anteriores
  await prisma.user.deleteMany({
    where: { email: { in: ["admin_media_test_root@thunderafit.test", "admin_media_test_personal@thunderafit.test"] } },
  });
  await prisma.exercise.deleteMany({
    where: { name: "Exercício Teste Mídia Fase 32" },
  });

  await prisma.user.create({
    data: {
      email: "admin_media_test_root@thunderafit.test",
      passwordHash: await bcrypt.hash("SenhaSegura@123", 12),
      role: "ADMIN",
    },
  });
  const adminLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_media_test_root@thunderafit.test", password: "SenhaSegura@123" });
  adminToken = adminLogin.body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "admin_media_test_personal@thunderafit.test", password: "SenhaSegura@123", role: "PERSONAL" });
  const personalLogin = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "admin_media_test_personal@thunderafit.test", password: "SenhaSegura@123" });
  personalToken = personalLogin.body.accessToken;

  const exercise = await prisma.exercise.create({
    data: {
      name: "Exercício Teste Mídia Fase 32",
      muscleGroup: "Peito",
      equipment: "Barra",
      description: "Exercício criado só para testar upload de mídia.",
    },
  });
  exerciseId = exercise.id;
});

afterAll(async () => {
  // Limpa o exercício de teste para não poluir a contagem do catálogo em
  // outras suítes (ex: src/fitness/__tests__/workouts.test.ts), já que a
  // ordem de execução do Jest entre arquivos não é garantida.
  await prisma.exercise.deleteMany({ where: { id: exerciseId } });
  await server.close();
  await prisma.$disconnect();
});

describe("Fase 32 — PUT /api/admin/exercises/:id/media", () => {
  it("PERSONAL (não-admin) recebe 403", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(res.status).toBe(403);
  });

  it("exercício inexistente recebe 404", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/00000000-0000-0000-0000-000000000000/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(res.status).toBe(404);
  });

  it("ADMIN define link do YouTube com sucesso", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(res.status).toBe(200);
    expect(res.body.exercise.mediaType).toBe("YOUTUBE");
    expect(res.body.exercise.mediaUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("link do YouTube Shorts é aceito (curadoria 2026-07-31, Pilates)", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ" });
    expect(res.status).toBe(200);
    expect(res.body.exercise.mediaUrl).toBe("https://www.youtube.com/shorts/dQw4w9WgXcQ");
  });

  it("link do YouTube inválido recebe 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://exemplo.com/nao-e-youtube" });
    expect(res.status).toBe(400);
  });

  it("ADMIN sobe um vídeo (mock do bucket) com sucesso", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", mediaDataUrl: `data:video/mp4;base64,${TINY_BASE64}` });
    expect(res.status).toBe(200);
    expect(res.body.exercise.mediaType).toBe("VIDEO");
    expect(res.body.exercise.mediaUrl).toContain("storage.googleapis.com");
  });

  it("ADMIN sobe um GIF (mock do bucket) com sucesso", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "GIF", mediaDataUrl: `data:image/gif;base64,${TINY_BASE64}` });
    expect(res.status).toBe(200);
    expect(res.body.exercise.mediaType).toBe("GIF");
  });

  it("formato de arquivo incompatível com o mediaType recebe 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", mediaDataUrl: `data:image/gif;base64,${TINY_BASE64}` });
    expect(res.status).toBe(400);
  });

  it("arquivo maior que o limite recebe 400", async () => {
    const hugeBase64 = "A".repeat(6_500_000);
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", mediaDataUrl: `data:video/mp4;base64,${hugeBase64}` });
    expect(res.status).toBe(400);
  });

  it("mediaType inválido recebe 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${exerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "PDF" });
    expect(res.status).toBe(400);
  });
});

describe("Fase 84 — youtubeSupplementUrl (link do YouTube por cima do vídeo/GIF próprio)", () => {
  let supplementExerciseId: string;

  beforeAll(async () => {
    const exercise = await prisma.exercise.create({
      data: {
        name: "Exercício Teste Suplemento YouTube Fase 84",
        muscleGroup: "Costas",
        equipment: "Máquina",
        description: "Exercício criado só para testar o link suplementar do YouTube.",
      },
    });
    supplementExerciseId = exercise.id;
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({ where: { id: supplementExerciseId } });
  });

  it("trocar de YOUTUBE pra VIDEO sem mandar o campo reaproveita o mediaUrl anterior como suplemento", async () => {
    await supertest(server.server)
      .put(`/api/admin/exercises/${supplementExerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa" });

    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${supplementExerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", mediaDataUrl: `data:video/mp4;base64,${TINY_BASE64}` });

    expect(res.status).toBe(200);
    expect(res.body.exercise.mediaType).toBe("VIDEO");
    expect(res.body.exercise.youtubeSupplementUrl).toBe("https://www.youtube.com/watch?v=aaaaaaaaaaa");
  });

  it("atualiza só o link suplementar (sem mandar arquivo novo), mantendo o mediaUrl do vídeo", async () => {
    const before = await prisma.exercise.findUnique({ where: { id: supplementExerciseId } });

    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${supplementExerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", youtubeSupplementUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb" });

    expect(res.status).toBe(200);
    expect(res.body.exercise.mediaUrl).toBe(before?.mediaUrl);
    expect(res.body.exercise.youtubeSupplementUrl).toBe("https://www.youtube.com/watch?v=bbbbbbbbbbb");
  });

  it("string vazia limpa o link suplementar de propósito", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${supplementExerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", youtubeSupplementUrl: "" });

    expect(res.status).toBe(200);
    expect(res.body.exercise.youtubeSupplementUrl).toBeNull();
  });

  it("link suplementar inválido recebe 400", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${supplementExerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", youtubeSupplementUrl: "https://exemplo.com/nao-e-youtube" });

    expect(res.status).toBe(400);
  });

  it("trocar pra YOUTUBE sempre limpa o suplemento (não faz sentido nesse caso)", async () => {
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${supplementExerciseId}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "YOUTUBE", youtubeUrl: "https://www.youtube.com/watch?v=ccccccccccc" });

    expect(res.status).toBe(200);
    expect(res.body.exercise.youtubeSupplementUrl).toBeNull();
  });

  it("virar VIDEO pela 1ª vez sem mandar nenhum arquivo recebe 400", async () => {
    const fresh = await prisma.exercise.create({
      data: {
        name: "Exercício Teste Suplemento Sem Arquivo Fase 84",
        muscleGroup: "Ombro",
        equipment: "Halteres",
        description: "Exercício criado só para testar a exigência de arquivo na 1ª troca pra mídia própria.",
      },
    });
    const res = await supertest(server.server)
      .put(`/api/admin/exercises/${fresh.id}/media`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mediaType: "VIDEO", youtubeSupplementUrl: "https://www.youtube.com/watch?v=ddddddddddd" });

    expect(res.status).toBe(400);
    await prisma.exercise.deleteMany({ where: { id: fresh.id } });
  });
});
