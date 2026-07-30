import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let server: import("fastify").FastifyInstance;
let personalId: string;
let personalToken: string;
let alunoToken: string; // ALUNO autenticado — não deveria conseguir criar convite

const pw = "SenhaSegura@123";

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const reg = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "invite_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalId = reg.body.user.id;
  personalToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "invite_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "invite_aluno_existing@thunderafit.test", password: pw, role: "ALUNO" });
  alunoToken = (
    await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "invite_aluno_existing@thunderafit.test", password: pw })
  ).body.accessToken;
});

afterAll(async () => {
  await prisma.clientInvite.deleteMany({ where: { personalId } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "invite_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("POST /api/client-invites — criar", () => {
  it("cria um convite com apelido, devolve o token (só desta vez)", async () => {
    const r = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "João da academia" });
    expect(r.status).toBe(201);
    expect(r.body.invite.label).toBe("João da academia");
    expect(r.body.invite.personalId).toBe(personalId);
    expect(typeof r.body.token).toBe("string");
    expect(r.body.token.length).toBeGreaterThan(20);
  });

  it("sem apelido retorna 400", async () => {
    const r = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "   " });
    expect(r.status).toBe(400);
  });

  it("ALUNO não pode criar convite (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ label: "Qualquer coisa" });
    expect(r.status).toBe(403);
  });

  it("com o limite de alunos (FREE, 3) já atingido, criar convite novo retorna 403", async () => {
    // Vincula 3 alunos reais (limite FREE) direto no banco, mais rápido que
    // 3 POSTs — o que importa aqui é a checagem de limite, já coberta em
    // detalhe por relations.test.ts.
    for (let i = 0; i < 3; i++) {
      const reg = await supertest(server.server)
        .post("/api/auth/register")
        .send({ email: `invite_limite_aluno${i}@thunderafit.test`, password: pw, role: "ALUNO" });
      await prisma.clientRelation.create({ data: { personalId, alunoId: reg.body.user.id } });
    }
    const r = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Vai falhar" });
    expect(r.status).toBe(403);

    // Limpa pra não afetar os describes seguintes deste arquivo.
    await prisma.clientRelation.deleteMany({ where: { personalId } });
  });
});

describe("GET /api/client-invites — listar", () => {
  it("lista só os convites do próprio profissional, não consumidos", async () => {
    const r = await supertest(server.server)
      .get("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    // Pelo menos o convite criado no describe anterior ("João da academia").
    expect(r.body.invites.length).toBeGreaterThanOrEqual(1);
    expect(r.body.invites.every((inv: any) => inv.personalId === personalId)).toBe(true);
  });
});

describe("DELETE /api/client-invites/:id — revogar", () => {
  it("revoga um convite pendente com sucesso", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Pra revogar" });
    const id = created.body.invite.id;

    const r = await supertest(server.server)
      .delete(`/api/client-invites/${id}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(204);

    const list = await supertest(server.server)
      .get("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(list.body.invites.find((inv: any) => inv.id === id)).toBeUndefined();
  });

  it("revogar convite de outro profissional retorna 404", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Não é seu" });

    const outroReg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "invite_outro_personal@thunderafit.test", password: pw, role: "PERSONAL" });
    const outroToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "invite_outro_personal@thunderafit.test", password: pw })
    ).body.accessToken;

    const r = await supertest(server.server)
      .delete(`/api/client-invites/${created.body.invite.id}`)
      .set("Authorization", `Bearer ${outroToken}`);
    expect(r.status).toBe(404);

    await prisma.user.delete({ where: { id: outroReg.body.user.id } });
  });

  it("revogar um convite já consumido retorna 400", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Vai ser consumido" });
    await prisma.clientInvite.update({
      where: { id: created.body.invite.id },
      data: { consumedAt: new Date(), consumedByAlunoId: "qualquer-id" },
    });

    const r = await supertest(server.server)
      .delete(`/api/client-invites/${created.body.invite.id}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(400);
  });
});

describe("GET /api/client-invites/preview — pública", () => {
  it("token válido: devolve valid=true + nome do profissional", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Preview OK" });

    const r = await supertest(server.server).get(
      `/api/client-invites/preview?token=${created.body.token}`
    );
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(true);
    expect(r.body.professionalType).toBe("PERSONAL");
    // Nunca devolve o apelido (é só de uso interno do Personal).
    expect(r.body.label).toBeUndefined();
  });

  it("token inexistente: valid=false", async () => {
    const r = await supertest(server.server).get(
      "/api/client-invites/preview?token=token-que-nao-existe-nunca"
    );
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(false);
  });

  it("token expirado: valid=false", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Vai expirar" });
    await prisma.clientInvite.update({
      where: { id: created.body.invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const r = await supertest(server.server).get(
      `/api/client-invites/preview?token=${created.body.token}`
    );
    expect(r.body.valid).toBe(false);
  });

  it("sem token retorna 400", async () => {
    const r = await supertest(server.server).get("/api/client-invites/preview");
    expect(r.status).toBe(400);
  });
});

describe("Consumo do convite — register/login criam o ClientRelation automaticamente", () => {
  it("cadastro (role ALUNO) com inviteToken válido cria o vínculo na mesma hora", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Consumo no cadastro" });

    const reg = await supertest(server.server).post("/api/auth/register").send({
      email: "invite_consumido_cadastro@thunderafit.test",
      password: pw,
      role: "ALUNO",
      name: "Fulano",
      inviteToken: created.body.token,
    });
    expect(reg.status).toBe(201);

    const relation = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId: reg.body.user.id } },
    });
    expect(relation).not.toBeNull();

    const invite = await prisma.clientInvite.findUnique({ where: { id: created.body.invite.id } });
    expect(invite?.consumedAt).not.toBeNull();
    expect(invite?.consumedByAlunoId).toBe(reg.body.user.id);
  });

  it("login (aluno JÁ tinha conta) com inviteToken válido também cria o vínculo", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Consumo no login" });

    // invite_aluno_existing já existe desde o beforeAll — nunca foi vinculado a este Personal.
    const login = await supertest(server.server).post("/api/auth/login").send({
      email: "invite_aluno_existing@thunderafit.test",
      password: pw,
      inviteToken: created.body.token,
    });
    expect(login.status).toBe(200);

    const alunoId = login.body.user.id;
    const relation = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
    expect(relation).not.toBeNull();

    await prisma.clientRelation.deleteMany({ where: { personalId, alunoId } });
  });

  it("cadastro como PERSONAL com um inviteToken (por engano) NÃO cria vínculo nenhum", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Não deveria consumir" });

    const reg = await supertest(server.server).post("/api/auth/register").send({
      email: "invite_personal_por_engano@thunderafit.test",
      password: pw,
      role: "PERSONAL",
      name: "Outro Personal",
      inviteToken: created.body.token,
    });
    expect(reg.status).toBe(201);

    const invite = await prisma.clientInvite.findUnique({ where: { id: created.body.invite.id } });
    // Convite continua intacto (não foi consumido por um PERSONAL se cadastrando).
    expect(invite?.consumedAt).toBeNull();

    await prisma.user.delete({ where: { id: reg.body.user.id } });
  });

  it("token inválido/inexistente no cadastro não quebra o cadastro (best-effort)", async () => {
    const reg = await supertest(server.server).post("/api/auth/register").send({
      email: "invite_token_invalido@thunderafit.test",
      password: pw,
      role: "ALUNO",
      name: "Sem convite de verdade",
      inviteToken: "token-totalmente-inventado",
    });
    expect(reg.status).toBe(201);
  });

  afterAll(async () => {
    await prisma.clientRelation.deleteMany({ where: { personalId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "invite_consumido_cadastro@thunderafit.test",
            "invite_token_invalido@thunderafit.test",
          ],
        },
      },
    });
  });
});

describe("POST /api/client-invites/consume — pra quem já está logado (correção pós-lançamento)", () => {
  // Achado real em produção: quem abre o link do convite já autenticado
  // (sessão de uma visita anterior) nunca passa pelo register/login/SSO de
  // novo — sem este endpoint, o convite nunca era consumido e o aluno
  // ficava "órfão" (cadastro existe, vínculo nunca acontece).
  it("aluno autenticado consome com sucesso e cria o vínculo", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Consumo autenticado" });

    const r = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ token: created.body.token });
    expect(r.status).toBe(200);
    expect(r.body.consumed).toBe(true);

    const login = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "invite_aluno_existing@thunderafit.test", password: pw });
    const alunoId = login.body.user.id;

    const relation = await prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
    expect(relation).not.toBeNull();

    await prisma.clientRelation.deleteMany({ where: { personalId, alunoId } });
  });

  it("PERSONAL autenticado tentando consumir recebe 403, convite continua intacto", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Não deveria consumir (papel errado)" });

    const r = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ token: created.body.token });
    expect(r.status).toBe(403);

    const invite = await prisma.clientInvite.findUnique({ where: { id: created.body.invite.id } });
    expect(invite?.consumedAt).toBeNull();
  });

  it("sem token no body retorna 400", async () => {
    const r = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({});
    expect(r.status).toBe(400);
  });

  it("token inválido/inexistente retorna 400 com motivo", async () => {
    const r = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ token: "token-que-nao-existe-nunca" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/inválido/i);
  });

  it("token expirado retorna 400 com motivo", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Vai expirar (consume)" });
    await prisma.clientInvite.update({
      where: { id: created.body.invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const r = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ token: created.body.token });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/expirou/i);
  });

  it("token já consumido retorna 400 com motivo", async () => {
    const created = await supertest(server.server)
      .post("/api/client-invites")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ label: "Vai ser consumido 2x" });

    const first = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ token: created.body.token });
    expect(first.status).toBe(200);

    const second = await supertest(server.server)
      .post("/api/client-invites/consume")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ token: created.body.token });
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/já foi usado/i);

    const login = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "invite_aluno_existing@thunderafit.test", password: pw });
    await prisma.clientRelation.deleteMany({ where: { personalId, alunoId: login.body.user.id } });
  });
});
