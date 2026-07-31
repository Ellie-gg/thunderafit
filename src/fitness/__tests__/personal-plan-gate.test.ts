import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import { PERSONAL_OVER_LIMIT_GRACE_DAYS } from "../../lib/plan-expiry";

// Fase 103 — testes de PONTA A PONTA (rotas HTTP reais), não só a função
// isolada de plan-expiry.test.ts: provam que o gate está de fato conectado
// nos caminhos de prescrição (Personal) e acesso (aluno), escopado pelo
// personalId do PROGRAMA/TREINO específico, não pela conta autenticada.
let server: import("fastify").FastifyInstance;
let personalId: string;
let personalToken: string;
let alunoIds: string[] = [];
let alunoTokens: string[] = [];
let templateId: string;
let workoutId: string;

const pw = "SenhaSegura@123";

async function forceBlocked() {
  const past = new Date(Date.now() - (PERSONAL_OVER_LIMIT_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: personalId }, data: { overLimiteAlunosSince: past } });
}

async function clearBlock() {
  await prisma.user.update({ where: { id: personalId }, data: { overLimiteAlunosSince: null } });
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const reg = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "plangate_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalId = reg.body.user.id;
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "plangate_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  // 4 alunos vinculados direto no banco — FREE (limite 3) já fica acima do
  // limite desde o início, sem depender da ordem de criação via API.
  for (let i = 0; i < 4; i++) {
    const r = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: `plangate_aluno${i}@thunderafit.test`, password: pw, role: "ALUNO" });
    alunoIds.push(r.body.user.id);
    await prisma.clientRelation.create({ data: { personalId, alunoId: r.body.user.id } });
    alunoTokens.push(
      (
        await supertest(server.server)
          .post("/api/auth/login")
          .send({ email: `plangate_aluno${i}@thunderafit.test`, password: pw })
      ).body.accessToken
    );
  }

  // Template + instância aplicada ao aluno 0, e um Workout "avulso" pro
  // aluno 1 — criados AGORA (Personal ainda não bloqueado), pra simular um
  // treino que já existia antes do plano vencer.
  const template = await supertest(server.server)
    .post("/api/workout-programs")
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ name: "Template Fase 103" });
  templateId = template.body.program.id;

  const workout = await supertest(server.server)
    .post("/api/workouts")
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ alunoId: alunoIds[1], name: "Treino avulso", letter: "A" });
  workoutId = workout.body.workout.id;
});

afterAll(async () => {
  const progs = await prisma.workoutProgram.findMany({ where: { personalId }, select: { id: true } });
  const progIds = progs.map((p) => p.id);
  await prisma.workout.deleteMany({ where: { OR: [{ personalId }, { programId: { in: progIds } }] } });
  await prisma.workoutProgram.deleteMany({ where: { personalId } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "plangate_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("Fase 103 — prescrição do Personal bloqueada quando acima do limite + carência vencida", () => {
  it("com o bloqueio ativo, criar treino avulso pra um aluno já vinculado retorna 403 PERSONAL_OVER_LIMIT", async () => {
    await forceBlocked();
    const r = await supertest(server.server)
      .post("/api/workouts")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[2], name: "Novo treino", letter: "B" });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/limite|regulariz|desvincul/i);
    // F3 (auditoria 2026-07-31): o `code` precisa chegar no corpo pro
    // frontend diferenciar este 403 de qualquer outro (tratamento visual
    // neutro em vez de vermelho de alarme).
    expect(r.body.code).toBe("PERSONAL_OVER_LIMIT");
  });

  it("aplicar um template a um aluno vinculado também retorna 403", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateId}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[2] });
    expect(r.status).toBe(403);
  });

  it("mas o Personal AINDA consegue LER a lista de alunos e o programa (precisa disso pra decidir quem desvincular)", async () => {
    const relations = await supertest(server.server)
      .get("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(relations.status).toBe(200);
    expect(relations.body.relations).toHaveLength(4);

    const program = await supertest(server.server)
      .get(`/api/workout-programs/${templateId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(program.status).toBe(200);
  });

  it("e o Personal AINDA consegue desvincular um aluno (autorregularização nunca é bloqueada)", async () => {
    const r = await supertest(server.server)
      .delete(`/api/relations/${alunoIds[3]}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(204);
  });

  afterAll(clearBlock);
});

describe("Fase 103 — acesso do ALUNO bloqueado quando o Personal DELE está acima do limite + carência vencida", () => {
  beforeAll(async () => {
    // O describe anterior desvinculou alunoIds[3] (testando a
    // autorregularização) — recria esse vínculo aqui pra garantir que a
    // contagem real (4) esteja de fato acima do limite FREE (3) antes de
    // forçar o timestamp de carência vencida. `getPersonalAccessStatus`
    // sempre RECONTA os vínculos reais a cada chamada — se estivesse só em
    // 3/3 (dentro do limite), o próprio gate limparia o timestamp forçado
    // na primeira checagem, e os testes de bloqueio abaixo falhariam.
    await prisma.clientRelation.create({ data: { personalId, alunoId: alunoIds[3] } });
    await forceBlocked();
  });
  afterAll(clearBlock);

  it("aluno tenta ver um treino avulso prescrito por esse Personal → 403 PERSONAL_PLAN_RESTRICTED", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${alunoTokens[1]}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/regulariz/i);
    expect(r.body.code).toBe("PERSONAL_PLAN_RESTRICTED");
  });

  it("aluno tenta concluir a sessão → 403", async () => {
    const r = await supertest(server.server)
      .post(`/api/workouts/${workoutId}/complete`)
      .set("Authorization", `Bearer ${alunoTokens[1]}`);
    expect(r.status).toBe(403);
  });

  it("o PRÓPRIO Personal continua vendo o mesmo treino normalmente (só a visão do aluno é bloqueada)", async () => {
    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
  });

  it("depois de desvincular alunos suficientes (volta ao limite), o mesmo aluno recupera o acesso", async () => {
    // Desvincula 2 alunos-alvo (aluno 0 e 2 — não o dono do treino testado,
    // aluno 1) pra voltar de 3 pra 1 vínculo restante (bem abaixo do limite
    // FREE de 3), garantindo a recuperação sem depender de contagem exata.
    await supertest(server.server)
      .delete(`/api/relations/${alunoIds[0]}`)
      .set("Authorization", `Bearer ${personalToken}`);
    await supertest(server.server)
      .delete(`/api/relations/${alunoIds[2]}`)
      .set("Authorization", `Bearer ${personalToken}`);

    const r = await supertest(server.server)
      .get(`/api/workouts/${workoutId}`)
      .set("Authorization", `Bearer ${alunoTokens[1]}`);
    expect(r.status).toBe(200);
  });
});
