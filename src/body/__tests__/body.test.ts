import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalId: string;
let aluno1Id: string;
let aluno2Id: string;
let tokenPersonal: string;
let tokenAluno1: string;
let tokenAluno2: string;

const pw = "SenhaSegura@123";
const EMAILS = [
  "test_body_personal@thunderafit.test",
  "test_body_aluno1@thunderafit.test",
  "test_body_aluno2@thunderafit.test",
];

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });

  const reg = async (email: string, role: string) =>
    (await supertest(server.server).post("/api/auth/register").send({ email, password: pw, role })).body.user.id;
  const login = async (email: string) =>
    (await supertest(server.server).post("/api/auth/login").send({ email, password: pw })).body.accessToken;

  personalId = await reg(EMAILS[0], "PERSONAL");
  aluno1Id = await reg(EMAILS[1], "ALUNO");
  aluno2Id = await reg(EMAILS[2], "ALUNO");
  tokenPersonal = await login(EMAILS[0]);
  tokenAluno1 = await login(EMAILS[1]);
  tokenAluno2 = await login(EMAILS[2]);

  // Só aluno1 é vinculado ao Personal — aluno2 é o controle de isolamento.
  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${tokenPersonal}`)
    .send({ alunoId: aluno1Id });
}, 30000);

afterAll(async () => {
  await prisma.bodyMeasurement.deleteMany({ where: { alunoId: { in: [aluno1Id, aluno2Id] } } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  await prisma.$disconnect();
  await server.close();
}, 30000);

beforeEach(async () => {
  await prisma.bodyMeasurement.deleteMany({ where: { alunoId: { in: [aluno1Id, aluno2Id] } } });
});

// Fase 121: `Anamnesis` é `alunoId @unique` — um snapshot sobrescrito. O app
// media progressão de CARGA com riqueza e não tinha NADA da progressão
// CORPORAL, que é o que o aluno associa a "está funcionando".
describe("Fase 121 — histórico de medições corporais", () => {
  it("ALUNO registra a própria medição e lê de volta", async () => {
    const c = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: 82.4, waistCm: 88, bodyFatPercent: 19.5 });
    expect(c.status).toBe(201);
    expect(c.body.measurement.weightKg).toBe(82.4);
    expect(c.body.measurement.recordedByRole).toBe("ALUNO");

    const l = await supertest(server.server)
      .get("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(l.status).toBe(200);
    expect(l.body.measurements).toHaveLength(1);
  });

  it("cintura e % de gordura são OPCIONAIS (só o peso é obrigatório)", async () => {
    const r = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: 80 });
    expect(r.status).toBe(201);
    expect(r.body.measurement.waistCm).toBeNull();
    expect(r.body.measurement.bodyFatPercent).toBeNull();
  });

  it("aceita vírgula como separador decimal e arredonda pra 1 casa", async () => {
    const r = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: "81,37" });
    expect(r.status).toBe(201);
    expect(r.body.measurement.weightKg).toBe(81.4);
  });

  it("PERSONAL vinculado REGISTRA a avaliação do aluno, marcada com a origem", async () => {
    const r = await supertest(server.server)
      .post(`/api/body-measurements?alunoId=${aluno1Id}`)
      .set("Authorization", `Bearer ${tokenPersonal}`)
      .send({ weightKg: 82, waistCm: 87.5 });
    expect(r.status).toBe(201);
    // A origem distingue balança de casa de avaliação presencial.
    expect(r.body.measurement.recordedByRole).toBe("PERSONAL");

    // E o aluno vê a medição que o Personal lançou pra ele.
    const l = await supertest(server.server)
      .get("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(l.body.measurements).toHaveLength(1);
    expect(l.body.measurements[0].recordedByRole).toBe("PERSONAL");
  });

  it("PERSONAL NÃO vinculado recebe 403 ao ler e ao escrever", async () => {
    const leitura = await supertest(server.server)
      .get(`/api/body-measurements?alunoId=${aluno2Id}`)
      .set("Authorization", `Bearer ${tokenPersonal}`);
    expect(leitura.status).toBe(403);

    const escrita = await supertest(server.server)
      .post(`/api/body-measurements?alunoId=${aluno2Id}`)
      .set("Authorization", `Bearer ${tokenPersonal}`)
      .send({ weightKg: 70 });
    expect(escrita.status).toBe(403);
    expect(await prisma.bodyMeasurement.count({ where: { alunoId: aluno2Id } })).toBe(0);
  });

  it("ALUNO ignora ?alunoId de outra pessoa (nunca lê nem grava no lugar dela)", async () => {
    await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: 82 });

    // aluno2 pede as medições do aluno1 — tem que receber as DELE (vazio).
    const l = await supertest(server.server)
      .get(`/api/body-measurements?alunoId=${aluno1Id}`)
      .set("Authorization", `Bearer ${tokenAluno2}`);
    expect(l.status).toBe(200);
    expect(l.body.measurements).toEqual([]);

    // E gravar com ?alunoId de outro grava na PRÓPRIA conta, não na dele.
    await supertest(server.server)
      .post(`/api/body-measurements?alunoId=${aluno1Id}`)
      .set("Authorization", `Bearer ${tokenAluno2}`)
      .send({ weightKg: 60 });
    expect(await prisma.bodyMeasurement.count({ where: { alunoId: aluno2Id } })).toBe(1);
    expect(await prisma.bodyMeasurement.count({ where: { alunoId: aluno1Id } })).toBe(1);
  });

  it("ordena da mais recente pra mais antiga", async () => {
    const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    for (const [d, peso] of [
      [10, 85],
      [5, 83],
      [1, 81],
    ] as const) {
      await supertest(server.server)
        .post("/api/body-measurements")
        .set("Authorization", `Bearer ${tokenAluno1}`)
        .send({ weightKg: peso, measuredAt: dias(d) });
    }
    const l = await supertest(server.server)
      .get("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(l.body.measurements.map((m: any) => m.weightKg)).toEqual([81, 83, 85]);
  });

  it("permite data retroativa mas recusa data no futuro", async () => {
    const ontem = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: 80, measuredAt: new Date(Date.now() - 86400000).toISOString() });
    expect(ontem.status).toBe(201);

    const amanha = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: 80, measuredAt: new Date(Date.now() + 86400000).toISOString() });
    expect(amanha.status).toBe(400);
  });

  it.each([
    ["peso ausente", {}],
    ["peso não numérico", { weightKg: "abc" }],
    ["peso absurdamente baixo", { weightKg: 5 }],
    ["peso absurdamente alto", { weightKg: 900 }],
    ["cintura absurda", { weightKg: 80, waistCm: 999 }],
    ["gordura acima de 75%", { weightKg: 80, bodyFatPercent: 90 }],
  ])("recusa %s com 400", async (_caso, payload) => {
    const r = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send(payload);
    expect(r.status).toBe(400);
    expect(await prisma.bodyMeasurement.count({ where: { alunoId: aluno1Id } })).toBe(0);
  });

  it("ALUNO exclui a própria medição; a de outro aluno dá 404 sem enumerar", async () => {
    const c = await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${tokenAluno1}`)
      .send({ weightKg: 82 });
    const id = c.body.measurement.id;

    const alheio = await supertest(server.server)
      .delete(`/api/body-measurements/${id}`)
      .set("Authorization", `Bearer ${tokenAluno2}`);
    expect(alheio.status).toBe(404);
    expect(await prisma.bodyMeasurement.count({ where: { id } })).toBe(1);

    const proprio = await supertest(server.server)
      .delete(`/api/body-measurements/${id}`)
      .set("Authorization", `Bearer ${tokenAluno1}`);
    expect(proprio.status).toBe(200);
    expect(await prisma.bodyMeasurement.count({ where: { id } })).toBe(0);
  });

  it("excluir o usuário leva as medições dele (regra do cascade manual)", async () => {
    // A regra está escrita em `src/admin/AGENTS.md`: tabela nova com coluna
    // estilo userId PRECISA entrar em `user-deletion.ts` à mão. Foi essa regra
    // que o ClientInvite quebrou (M4 da auditoria) — aqui ela é verificada.
    const email = "test_body_descartavel@thunderafit.test";
    await prisma.user.deleteMany({ where: { email } });
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email, password: pw, role: "ALUNO" });
    const id = reg.body.user.id;
    const token = (await supertest(server.server).post("/api/auth/login").send({ email, password: pw })).body
      .accessToken;
    await supertest(server.server)
      .post("/api/body-measurements")
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 75 });
    expect(await prisma.bodyMeasurement.count({ where: { alunoId: id } })).toBe(1);

    const { deleteUserCascade } = await import("../../lib/user-deletion");
    await deleteUserCascade(id);
    expect(await prisma.bodyMeasurement.count({ where: { alunoId: id } })).toBe(0);
  }, 30000);
});
