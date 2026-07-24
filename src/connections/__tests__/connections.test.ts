import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
const pw = "SenhaSegura@123";

const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

async function reg(key: string, email: string, role: string) {
  const r = await supertest(server.server).post("/api/auth/register").send({ email, password: pw, role });
  ids[key] = r.body.user.id;
  const l = await supertest(server.server).post("/api/auth/login").send({ email, password: pw });
  tokens[key] = l.body.accessToken;
}

function auth(key: string) {
  return { Authorization: `Bearer ${tokens[key]}` };
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  await reg("proPalhoca", "conn_pro_palhoca@thunderafit.test", "PERSONAL");
  await reg("proCuritiba", "conn_pro_curitiba@thunderafit.test", "PERSONAL");
  await reg("proHidden", "conn_pro_hidden@thunderafit.test", "PERSONAL"); // não opta por disponível
  await reg("proFull", "conn_pro_full@thunderafit.test", "PERSONAL"); // vai ficar 3/3
  await reg("proFree", "conn_pro_free@thunderafit.test", "PERSONAL"); // fica FREE de propósito
  await reg("proPlus", "conn_pro_plus@thunderafit.test", "PERSONAL");
  await reg("aluno", "conn_aluno@thunderafit.test", "ALUNO");
  await reg("aluno2", "conn_aluno2@thunderafit.test", "ALUNO");
  for (let i = 0; i < 4; i++) await reg(`full${i}`, `conn_full_aluno${i}@thunderafit.test`, "ALUNO");

  // availableForNewStudents agora exige Base+ (billing 3 degraus) — sobe pra
  // Base os profissionais que vão ficar disponíveis neste teste, SEM tocar
  // limiteAlunos (fica em 3 no proFull de propósito: o teste de limite 3/3
  // mais abaixo e o gate de disponibilidade são preocupações independentes).
  // proPlus sobe pra Plus especificamente para testar a prioridade no diretório.
  await prisma.user.updateMany({
    where: { id: { in: [ids.proPalhoca, ids.proCuritiba, ids.proFull] } },
    data: { planoAssinatura: "BASE" },
  });
  await prisma.user.update({ where: { id: ids.proPlus }, data: { planoAssinatura: "PLUS" } });

  // Perfis: define disponibilidade + localização via o próprio endpoint.
  await supertest(server.server).put("/api/professionals/me").set(auth("proPalhoca"))
    .send({ availableForNewStudents: true, location: "Palhoça, SC", bio: "Treino funcional" });
  await supertest(server.server).put("/api/professionals/me").set(auth("proCuritiba"))
    .send({ availableForNewStudents: true, location: "Curitiba, PR", bio: "Musculação" });
  await supertest(server.server).put("/api/professionals/me").set(auth("proFull"))
    .send({ availableForNewStudents: true, location: "Palhoça, SC" });
  await supertest(server.server).put("/api/professionals/me").set(auth("proPlus"))
    .send({ availableForNewStudents: true, location: "Palhoça, SC" });
  // proHidden preenche localização mas NÃO ativa disponibilidade.
  await supertest(server.server).put("/api/professionals/me").set(auth("proHidden"))
    .send({ location: "Palhoça, SC" });

  // proFull vincula 3 alunos diretamente (fica 3/3).
  for (let i = 0; i < 3; i++) {
    await supertest(server.server).post("/api/relations").set(auth("proFull")).send({ alunoId: ids[`full${i}`] });
  }
}, 60000);

afterAll(async () => {
  const allIds = Object.values(ids);
  await prisma.connectionRequest.deleteMany({ where: { alunoId: { in: allIds } } });
  await prisma.clientRelation.deleteMany({ where: { personalId: { in: allIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: allIds } } });
  await prisma.user.deleteMany({ where: { email: { contains: "conn_" } } });
  await prisma.$disconnect();
  await server.close();
}, 30000);

describe("Fase 21 BLOCO 1 — busca de profissionais (opt-in + localização)", () => {
  it("busca por 'Palhoça' encontra os disponíveis de Palhoça, NÃO o de Curitiba nem o oculto", async () => {
    const r = await supertest(server.server)
      .get("/api/professionals/search?location=palho") // parcial + case-insensitive
      .set(auth("aluno"));
    expect(r.status).toBe(200);
    const emails = r.body.professionals.map((p: any) => p.email);
    expect(emails).toContain("conn_pro_palhoca@thunderafit.test");
    expect(emails).toContain("conn_pro_full@thunderafit.test");
    expect(emails).toContain("conn_pro_plus@thunderafit.test");
    expect(emails).not.toContain("conn_pro_curitiba@thunderafit.test");
    expect(emails).not.toContain("conn_pro_hidden@thunderafit.test"); // não disponível
  });

  it("busca por 'Curitiba' encontra só o de Curitiba", async () => {
    const r = await supertest(server.server)
      .get("/api/professionals/search?location=curitiba")
      .set(auth("aluno"));
    const emails = r.body.professionals.map((p: any) => p.email);
    expect(emails).toEqual(["conn_pro_curitiba@thunderafit.test"]);
  });

  it("profissional que não optou por disponível nunca aparece", async () => {
    const r = await supertest(server.server).get("/api/professionals/search").set(auth("aluno"));
    const emails = r.body.professionals.map((p: any) => p.email);
    expect(emails).not.toContain("conn_pro_hidden@thunderafit.test");
  });

  it("ALUNO não consegue editar perfil público (403)", async () => {
    const r = await supertest(server.server).put("/api/professionals/me").set(auth("aluno"))
      .send({ availableForNewStudents: true });
    expect(r.status).toBe(403);
  });
});

describe("Billing 3 degraus — gate de disponibilidade no diretório + prioridade Plus", () => {
  it("Personal FREE não pode ATIVAR disponibilidade (403)", async () => {
    const r = await supertest(server.server).put("/api/professionals/me").set(auth("proFree"))
      .send({ availableForNewStudents: true });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/[Bb]ase/);

    const check = await prisma.user.findUnique({ where: { id: ids.proFree } });
    expect(check?.availableForNewStudents).toBe(false);
  });

  it("Personal FREE ainda pode salvar localização/bio (só a disponibilidade é bloqueada)", async () => {
    const r = await supertest(server.server).put("/api/professionals/me").set(auth("proFree"))
      .send({ location: "Palhoça, SC" });
    expect(r.status).toBe(200);
    expect(r.body.profile.location).toBe("Palhoça, SC");
  });

  it("Personal FREE nunca aparece no diretório mesmo que o campo já estivesse true no banco (defesa em profundidade)", async () => {
    // Simula um registro inconsistente (ex: dado antigo de antes do gate existir).
    await prisma.user.update({ where: { id: ids.proFree }, data: { availableForNewStudents: true } });
    const r = await supertest(server.server).get("/api/professionals/search?location=palho").set(auth("aluno"));
    const emails = r.body.professionals.map((p: any) => p.email);
    expect(emails).not.toContain("conn_pro_free@thunderafit.test");
    await prisma.user.update({ where: { id: ids.proFree }, data: { availableForNewStudents: false } });
  });

  it("desligar disponibilidade continua permitido em qualquer degrau (inclusive FREE)", async () => {
    const r = await supertest(server.server).put("/api/professionals/me").set(auth("proFree"))
      .send({ availableForNewStudents: false });
    expect(r.status).toBe(200);
  });

  it("Plus aparece ANTES de Base nos resultados de busca (destaque/prioridade)", async () => {
    const r = await supertest(server.server).get("/api/professionals/search?location=palho").set(auth("aluno"));
    const emails = r.body.professionals.map((p: any) => p.email);
    const plusIndex = emails.indexOf("conn_pro_plus@thunderafit.test");
    const baseIndex = emails.indexOf("conn_pro_palhoca@thunderafit.test");
    expect(plusIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(plusIndex).toBeLessThan(baseIndex);
  });

  it("resultado da busca inclui planoAssinatura, pro frontend destacar o Plus", async () => {
    const r = await supertest(server.server).get("/api/professionals/search?location=palho").set(auth("aluno"));
    const plus = r.body.professionals.find((p: any) => p.email === "conn_pro_plus@thunderafit.test");
    expect(plus.planoAssinatura).toBe("PLUS");
  });
});

describe("Fase 21 BLOCO 1 — solicitação + aprovação manual", () => {
  it("aluno solicita → PENDENTE; profissional vê pendente; aluno vê status", async () => {
    const r = await supertest(server.server).post("/api/connection-requests").set(auth("aluno"))
      .send({ professionalId: ids.proPalhoca });
    expect(r.status).toBe(201);
    expect(r.body.request.status).toBe("PENDENTE");

    const proView = await supertest(server.server).get("/api/connection-requests").set(auth("proPalhoca"));
    expect(proView.body.requests.some((q: any) => q.counterpart.email === "conn_aluno@thunderafit.test" && q.status === "PENDENTE")).toBe(true);

    const alunoView = await supertest(server.server).get("/api/connection-requests").set(auth("aluno"));
    expect(alunoView.body.requests.some((q: any) => q.counterpart.id === ids.proPalhoca && q.status === "PENDENTE")).toBe(true);

    // Profissional foi notificado.
    const notifs = await prisma.notification.findMany({ where: { userId: ids.proPalhoca, type: "connection_request" } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it("solicitação duplicada pendente → 409", async () => {
    const r = await supertest(server.server).post("/api/connection-requests").set(auth("aluno"))
      .send({ professionalId: ids.proPalhoca });
    expect(r.status).toBe(409);
  });

  it("solicitar a profissional não disponível → 409", async () => {
    const r = await supertest(server.server).post("/api/connection-requests").set(auth("aluno"))
      .send({ professionalId: ids.proHidden });
    expect(r.status).toBe(409);
  });

  it("não-aluno não pode solicitar (403)", async () => {
    const r = await supertest(server.server).post("/api/connection-requests").set(auth("proCuritiba"))
      .send({ professionalId: ids.proPalhoca });
    expect(r.status).toBe(403);
  });

  it("profissional ACEITA → cria ClientRelation real + status ACEITA + notifica aluno", async () => {
    const pending = (await supertest(server.server).get("/api/connection-requests").set(auth("proPalhoca")))
      .body.requests.find((q: any) => q.counterpart.email === "conn_aluno@thunderafit.test");
    const r = await supertest(server.server)
      .post(`/api/connection-requests/${pending.id}/accept`)
      .set(auth("proPalhoca"));
    expect(r.status).toBe(200);
    expect(r.body.request.status).toBe("ACEITA");

    // ClientRelation real criado.
    const rel = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: ids.proPalhoca, alunoId: ids.aluno } },
    });
    expect(rel).not.toBeNull();

    // Aluno notificado do aceite.
    const notifs = await prisma.notification.findMany({ where: { userId: ids.aluno, type: "connection_accepted" } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it("aceitar de novo (já respondida) → 409", async () => {
    const req = await prisma.connectionRequest.findFirst({ where: { alunoId: ids.aluno, professionalId: ids.proPalhoca } });
    const r = await supertest(server.server).post(`/api/connection-requests/${req!.id}/accept`).set(auth("proPalhoca"));
    expect(r.status).toBe(409);
  });

  it("RECUSAR: aluno2 solicita a proCuritiba, que recusa → RECUSADA, sem vínculo, aluno notificado", async () => {
    const created = await supertest(server.server).post("/api/connection-requests").set(auth("aluno2"))
      .send({ professionalId: ids.proCuritiba });
    const reqId = created.body.request.id;
    const r = await supertest(server.server).post(`/api/connection-requests/${reqId}/reject`).set(auth("proCuritiba"));
    expect(r.status).toBe(200);
    expect(r.body.request.status).toBe("RECUSADA");

    const rel = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: ids.proCuritiba, alunoId: ids.aluno2 } },
    });
    expect(rel).toBeNull();
    const notifs = await prisma.notification.findMany({ where: { userId: ids.aluno2, type: "connection_rejected" } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it("re-solicitar após recusa é permitido (volta a PENDENTE)", async () => {
    const r = await supertest(server.server).post("/api/connection-requests").set(auth("aluno2"))
      .send({ professionalId: ids.proCuritiba });
    expect(r.status).toBe(201);
    expect(r.body.request.status).toBe("PENDENTE");
  });

  it("ACEITAR com profissional no LIMITE (3/3) → 403 e a solicitação PERMANECE PENDENTE", async () => {
    // full3 (4º aluno) solicita ao proFull, que já tem 3/3.
    const created = await supertest(server.server).post("/api/connection-requests").set(auth("full3"))
      .send({ professionalId: ids.proFull });
    const reqId = created.body.request.id;
    const r = await supertest(server.server).post(`/api/connection-requests/${reqId}/accept`).set(auth("proFull"));
    expect(r.status).toBe(403); // limite atingido, propagado do relations.service

    // A solicitação continua PENDENTE (não vira ACEITA nem cria vínculo).
    const req = await prisma.connectionRequest.findUnique({ where: { id: reqId } });
    expect(req?.status).toBe("PENDENTE");
    const rel = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId: ids.proFull, alunoId: ids.full3 } },
    });
    expect(rel).toBeNull();
  });
});
