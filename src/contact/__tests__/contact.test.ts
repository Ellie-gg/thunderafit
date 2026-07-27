import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

// Fase 78 — mocka o envio de e-mail (mesmo padrão de jest.mock já usado
// pra dependências externas neste repo, ex: admin-exercise-media.test.ts
// pro storage).
const sendMailMock = jest.fn();
jest.mock("../../lib/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
}));

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
  await reg("aluno", "contact_aluno@thunderafit.test", "ALUNO");
  await reg("personal", "contact_personal@thunderafit.test", "PERSONAL");
});

afterEach(() => {
  sendMailMock.mockReset();
});

afterAll(async () => {
  await prisma.contactMessage.deleteMany({ where: { userId: { in: Object.values(ids) } } });
  await prisma.user.deleteMany({ where: { email: { contains: "contact_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("Fase 78 — Fale Conosco (POST /api/contact)", () => {
  it("sem autenticação → 401", async () => {
    const r = await supertest(server.server).post("/api/contact").send({ title: "Oi", message: "Teste" });
    expect(r.status).toBe(401);
  });

  it("sem título → 400", async () => {
    const r = await supertest(server.server).post("/api/contact").set(auth("aluno")).send({ message: "Só mensagem" });
    expect(r.status).toBe(400);
  });

  it("sem mensagem → 400", async () => {
    const r = await supertest(server.server).post("/api/contact").set(auth("aluno")).send({ title: "Só título" });
    expect(r.status).toBe(400);
  });

  it("mensagem com mais de 500 caracteres → 400", async () => {
    const r = await supertest(server.server)
      .post("/api/contact")
      .set(auth("aluno"))
      .send({ title: "Título", message: "a".repeat(501) });
    expect(r.status).toBe(400);
  });

  it("título com mais de 120 caracteres → 400", async () => {
    const r = await supertest(server.server)
      .post("/api/contact")
      .set(auth("aluno"))
      .send({ title: "a".repeat(121), message: "Mensagem válida" });
    expect(r.status).toBe(400);
  });

  it("aluno envia mensagem válida → grava no banco e tenta enviar e-mail", async () => {
    sendMailMock.mockResolvedValue(true);
    const r = await supertest(server.server)
      .post("/api/contact")
      .set(auth("aluno"))
      .send({ title: "Dúvida sobre o app", message: "Como funciona o plano Plus?" });
    expect(r.status).toBe(201);
    expect(r.body.emailSent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const [args] = sendMailMock.mock.calls[0];
    expect(args.subject).toContain("Dúvida sobre o app");
    expect(args.text).toContain("Como funciona o plano Plus?");

    const saved = await prisma.contactMessage.findUnique({ where: { id: r.body.id } });
    expect(saved?.userId).toBe(ids.aluno);
    expect(saved?.role).toBe("ALUNO");
    expect(saved?.emailSentAt).not.toBeNull();
  });

  it("personal envia mensagem válida", async () => {
    sendMailMock.mockResolvedValue(true);
    const r = await supertest(server.server)
      .post("/api/contact")
      .set(auth("personal"))
      .send({ title: "Sugestão", message: "Adorei o novo recurso de mensagens." });
    expect(r.status).toBe(201);
    const saved = await prisma.contactMessage.findUnique({ where: { id: r.body.id } });
    expect(saved?.role).toBe("PERSONAL");
  });

  it("falha no envio de e-mail não derruba a requisição — mensagem continua salva", async () => {
    sendMailMock.mockRejectedValue(new Error("SMTP indisponível"));
    const r = await supertest(server.server)
      .post("/api/contact")
      .set(auth("aluno"))
      .send({ title: "Teste de falha", message: "Deve salvar mesmo se o e-mail falhar." });
    expect(r.status).toBe(201);
    expect(r.body.emailSent).toBe(false);

    const saved = await prisma.contactMessage.findUnique({ where: { id: r.body.id } });
    expect(saved).not.toBeNull();
    expect(saved?.emailSentAt).toBeNull();
  });

  it("sem transporte de e-mail configurado (sendMail retorna false) → ainda salva, emailSent false", async () => {
    sendMailMock.mockResolvedValue(false);
    const r = await supertest(server.server)
      .post("/api/contact")
      .set(auth("aluno"))
      .send({ title: "Sem SMTP", message: "Deve salvar mesmo sem SMTP configurado." });
    expect(r.status).toBe(201);
    expect(r.body.emailSent).toBe(false);
  });
});
