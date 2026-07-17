import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import { getStripe } from "../stripe";

let server: import("fastify").FastifyInstance;
let personalToken: string;
let alunoToken: string;
let personalId: string;
let alunoIds: string[] = [];

const pw = "SenhaSegura@123";
const CUSTOMER = "cus_test_billing_1";
const SUBSCRIPTION = "sub_test_billing_1";

/** Assina um payload com a MESMA cripto do Stripe (HMAC + webhook secret). */
function signed(eventObj: unknown): { payload: string; header: string } {
  const payload = JSON.stringify(eventObj);
  const header = getStripe().webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return { payload, header };
}

function postWebhook(payload: string, header?: string) {
  const req = supertest(server.server)
    .post("/api/billing/webhook")
    .set("Content-Type", "application/json");
  if (header) req.set("stripe-signature", header);
  // envia a STRING crua (não um objeto) para os bytes baterem com a assinatura
  return req.send(payload);
}

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const reg = async (email: string, role: string) =>
    (await supertest(server.server).post("/api/auth/register").send({ email, password: pw, role }))
      .body.user.id;
  personalId = await reg("billing_personal@thunderafit.test", "PERSONAL");
  personalToken = (
    await supertest(server.server).post("/api/auth/login").send({ email: "billing_personal@thunderafit.test", password: pw })
  ).body.accessToken;

  for (let i = 0; i < 5; i++) {
    alunoIds.push(await reg(`billing_aluno${i}@thunderafit.test`, "ALUNO"));
  }
  alunoToken = (
    await supertest(server.server).post("/api/auth/login").send({ email: "billing_aluno0@thunderafit.test", password: pw })
  ).body.accessToken;

  // Vincula 3 alunos (atinge o limite Freemium 3/3).
  for (let i = 0; i < 3; i++) {
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[i] });
  }
});

afterAll(async () => {
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "billing_" } } });
  await prisma.$disconnect();
  await server.close();
  jest.restoreAllMocks();
});

describe("Fase 20 BLOCO 1 — segurança do webhook (assinatura Stripe)", () => {
  it("rejeita (400) requisição SEM assinatura", async () => {
    const { payload } = signed({ id: "evt_x", type: "ping", data: { object: {} } });
    const r = await postWebhook(payload); // sem header stripe-signature
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/[Aa]ssinatura/);
  });

  it("rejeita (400) requisição com assinatura INVÁLIDA", async () => {
    const { payload } = signed({ id: "evt_x", type: "ping", data: { object: {} } });
    const r = await postWebhook(payload, "t=123,v1=assinatura_falsa_deadbeef");
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/inválida/i);
  });

  it("rejeita (400) quando o corpo foi adulterado após assinar", async () => {
    const { header } = signed({ id: "evt_x", type: "ping", data: { object: {} } });
    // assina um payload mas envia OUTRO — a verificação deve falhar
    const r = await postWebhook(JSON.stringify({ id: "evt_y", type: "tampered" }), header);
    expect(r.status).toBe(400);
  });

  it("aceita (200) requisição com assinatura VÁLIDA (evento não tratado)", async () => {
    const { payload, header } = signed({
      id: "evt_ping",
      type: "invoice.paid",
      data: { object: {} },
    });
    const r = await postWebhook(payload, header);
    expect(r.status).toBe(200);
    expect(r.body.received).toBe(true);
  });
});

describe("Fase 20 BLOCO 2 — upgrade via webhook: PAGO + limite 50 + 4º aluno liberado", () => {
  it("antes do upgrade, o 4º vínculo é bloqueado (limite 3/3)", async () => {
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[3] });
    expect(r.status).toBe(403);
  });

  it("checkout.session.completed assinado → usuário vira PAGO, limite 50, customer salvo", async () => {
    const { payload, header } = signed({
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          client_reference_id: personalId,
          customer: CUSTOMER,
          subscription: SUBSCRIPTION,
          payment_status: "paid",
        },
      },
    });
    const r = await postWebhook(payload, header);
    expect(r.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: personalId } });
    expect(user?.planoAssinatura).toBe("PAGO");
    expect(user?.limiteAlunos).toBe(50);
    expect(user?.stripeCustomerId).toBe(CUSTOMER);
    expect(user?.stripeSubscriptionId).toBe(SUBSCRIPTION);
  });

  it("agora o 4º vínculo é permitido (201)", async () => {
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[3] });
    expect(r.status).toBe(201);
  });
});

describe("Fase 20 BLOCO 3 — downgrade: FREE + limite 3, SEM quebrar vínculos existentes", () => {
  it("customer.subscription.deleted assinado → FREE + limite 3", async () => {
    const { payload, header } = signed({
      id: "evt_sub_deleted_1",
      type: "customer.subscription.deleted",
      data: { object: { id: SUBSCRIPTION, customer: CUSTOMER, status: "canceled" } },
    });
    const r = await postWebhook(payload, header);
    expect(r.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    expect(user?.planoAssinatura).toBe("FREE");
    expect(user?.limiteAlunos).toBe(3);
  });

  it("os 4 vínculos existentes CONTINUAM (downgrade não desfaz)", async () => {
    const r = await supertest(server.server)
      .get("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.relations).toHaveLength(4);
  });

  it("mas um 5º vínculo NOVO é bloqueado (4 >= limite 3)", async () => {
    const r = await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoIds[4] });
    expect(r.status).toBe(403);
  });

  it("REORDENAÇÃO: um subscription.updated(active) OBSOLETO reentregue APÓS o cancelamento é IGNORADO (não reativa PAGO)", async () => {
    // Após o delete, stripeSubscriptionId foi zerado. Um evento antigo da
    // subscription cancelada não casa mais → deve ser ignorado.
    const { payload, header } = signed({
      id: "evt_stale_updated",
      type: "customer.subscription.updated",
      data: { object: { id: SUBSCRIPTION, customer: CUSTOMER, status: "active" } },
    });
    const r = await postWebhook(payload, header);
    expect(r.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    expect(user?.planoAssinatura).toBe("FREE"); // continua FREE — não reativou
    expect(user?.limiteAlunos).toBe(3);
  });
});

describe("Fase 20 — pagamento assíncrono (boleto/Pix): sem PAGO antes de confirmar", () => {
  let proId: string;
  let proToken: string;
  const CUST = "cus_test_async_1";
  const SUB = "sub_test_async_1";

  beforeAll(async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "billing_async@thunderafit.test", password: pw, role: "PERSONAL" });
    proId = reg.body.user.id;
    proToken = (
      await supertest(server.server).post("/api/auth/login").send({ email: "billing_async@thunderafit.test", password: pw })
    ).body.accessToken;
  });

  it("checkout.session.completed com payment_status='unpaid' NÃO concede PAGO (só vincula ids)", async () => {
    const { payload, header } = signed({
      id: "evt_async_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_async_1",
          client_reference_id: proId,
          customer: CUST,
          subscription: SUB,
          payment_status: "unpaid",
        },
      },
    });
    const r = await postWebhook(payload, header);
    expect(r.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: proId } });
    expect(user?.planoAssinatura).toBe("FREE"); // ainda não pagou
    expect(user?.stripeCustomerId).toBe(CUST); // mas já vinculado p/ casar eventos futuros
    expect(user?.stripeSubscriptionId).toBe(SUB);
  });

  it("async_payment_succeeded → agora sim vira PAGO + limite 50", async () => {
    const { payload, header } = signed({
      id: "evt_async_paid",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_async_1",
          client_reference_id: proId,
          customer: CUST,
          subscription: SUB,
          payment_status: "paid",
        },
      },
    });
    const r = await postWebhook(payload, header);
    expect(r.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: proId } });
    expect(user?.planoAssinatura).toBe("PAGO");
    expect(user?.limiteAlunos).toBe(50);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: "billing_async@thunderafit.test" } });
  });
});

describe("Fase 20 — checkout-session e portal (API do Stripe mockada)", () => {
  it("POST /api/billing/checkout-session como PERSONAL retorna a URL de checkout", async () => {
    const stripe = getStripe();
    // usuário já tem customer (do bloco 2), então customers.create não é chamado
    const sessionsCreate = jest
      .spyOn(stripe.checkout.sessions, "create")
      .mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_mock" } as any);

    const r = await supertest(server.server)
      .post("/api/billing/checkout-session")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ interval: "monthly" });

    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/checkout\.stripe\.com/);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    // confere que passou o priceId mensal e o client_reference_id
    const arg = sessionsCreate.mock.calls[0][0] as any;
    expect(arg.client_reference_id).toBe(personalId);
    expect(arg.line_items[0].price).toBe(process.env.STRIPE_PRICE_ID_MONTHLY);
    sessionsCreate.mockRestore();
  });

  it("checkout-session como ALUNO é bloqueado (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/checkout-session")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ interval: "monthly" });
    expect(r.status).toBe(403);
  });

  it("checkout-session sem autenticação é bloqueado (401)", async () => {
    const r = await supertest(server.server)
      .post("/api/billing/checkout-session")
      .send({ interval: "monthly" });
    expect(r.status).toBe(401);
  });

  it("POST /api/billing/portal retorna a URL do portal do cliente", async () => {
    const stripe = getStripe();
    const portalCreate = jest
      .spyOn(stripe.billingPortal.sessions, "create")
      .mockResolvedValue({ url: "https://billing.stripe.com/p/session/mock" } as any);

    const r = await supertest(server.server)
      .post("/api/billing/portal")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({});

    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/billing\.stripe\.com/);
    portalCreate.mockRestore();
  });
});
