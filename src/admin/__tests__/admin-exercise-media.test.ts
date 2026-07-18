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
