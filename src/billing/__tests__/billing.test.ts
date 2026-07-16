import supertest from "supertest";
import { buildApp } from "../../app";

let server: import("fastify").FastifyInstance;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

describe("POST /api/billing/webhook (stub)", () => {
  it("aceita um payload com event e responde 200", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/webhook")
      .send({ event: "subscription.created", data: { userId: "abc123" } });
    expect(r.status).toBe(200);
    expect(r.body.received).toBe(true);
  });

  it("retorna 400 quando event está ausente", async () => {
    const r = await supertest(server.server).post("/api/billing/webhook").send({ data: {} });
    expect(r.status).toBe(400);
    expect(r.body.error).toBeDefined();
  });

  it("não exige autenticação (webhook externo não carrega nosso JWT)", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/webhook")
      .send({ event: "ping" });
    expect(r.status).toBe(200);
  });
});
