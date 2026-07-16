import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import foodsSeed from "../../../data/foods_seed.json";

let server: import("fastify").FastifyInstance;
let nutriToken: string;
let nutriId: string;
let alunoToken: string;
let vinculadoAlunoId: string;
let naoVinculadoAlunoId: string;
let dietPlanId: string;
let mealId: string;
let frangoId: string;
let arrozId: string;

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regNutri = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_nutrimod_nutri@thunderafit.test", password: "SenhaSegura@123", role: "NUTRICIONISTA" });
  nutriId = regNutri.body.user.id;

  const regAluno1 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_nutrimod_aluno1@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  vinculadoAlunoId = regAluno1.body.user.id;

  const regAluno2 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "test_nutrimod_aluno2@thunderafit.test", password: "SenhaSegura@123", role: "ALUNO" });
  naoVinculadoAlunoId = regAluno2.body.user.id;

  const loginNutri = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_nutrimod_nutri@thunderafit.test", password: "SenhaSegura@123" });
  nutriToken = loginNutri.body.accessToken;

  const loginAluno = await supertest(server.server)
    .post("/api/auth/login")
    .send({ email: "test_nutrimod_aluno1@thunderafit.test", password: "SenhaSegura@123" });
  alunoToken = loginAluno.body.accessToken;

  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${nutriToken}`)
    .send({ alunoId: vinculadoAlunoId });

  const frango = await prisma.food.findUnique({ where: { name: "Peito de Frango Grelhado" } });
  const arroz = await prisma.food.findUnique({ where: { name: "Arroz Branco Cozido" } });
  frangoId = frango!.id;
  arrozId = arroz!.id;
});

afterAll(async () => {
  await prisma.dietFood.deleteMany({ where: { dietMeal: { dietPlan: { nutricionistaId: nutriId } } } });
  await prisma.dietMeal.deleteMany({ where: { dietPlan: { nutricionistaId: nutriId } } });
  await prisma.dietPlan.deleteMany({ where: { nutricionistaId: nutriId } });
  await prisma.clientRelation.deleteMany({ where: { personalId: nutriId } });
  await prisma.user.deleteMany({ where: { email: { contains: "test_nutrimod_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("GET /api/foods", () => {
  it("retorna o catálogo completo de alimentos", async () => {
    const r = await supertest(server.server)
      .get("/api/foods")
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(r.status).toBe(200);
    expect(r.body.foods).toHaveLength(foodsSeed.length);
  });
});

describe("POST /api/diet-plans", () => {
  it("cria plano de dieta para aluno vinculado com 201", async () => {
    const r = await supertest(server.server)
      .post("/api/diet-plans")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Plano de Cutting - Semana 1" });
    expect(r.status).toBe(201);
    expect(r.body.plan.id).toBeDefined();
    dietPlanId = r.body.plan.id;
  });

  it("tenta criar plano para aluno não vinculado retorna 403", async () => {
    const r = await supertest(server.server)
      .post("/api/diet-plans")
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ alunoId: naoVinculadoAlunoId, name: "Plano X" });
    expect(r.status).toBe(403);
  });

  it("um ALUNO não pode criar plano de dieta (403)", async () => {
    const r = await supertest(server.server)
      .post("/api/diet-plans")
      .set("Authorization", `Bearer ${alunoToken}`)
      .send({ alunoId: vinculadoAlunoId, name: "Plano Y" });
    expect(r.status).toBe(403);
  });
});

describe("POST /api/diet-plans/:id/meals e /foods — agregação de macros", () => {
  it("adiciona a refeição 'Almoço' ao plano", async () => {
    const r = await supertest(server.server)
      .post(`/api/diet-plans/${dietPlanId}/meals`)
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ name: "Almoço", time: "12:00", order: 1 });
    expect(r.status).toBe(201);
    mealId = r.body.meal.id;
  });

  it("adiciona 2 porções de frango e 1 porção de arroz à refeição", async () => {
    const r1 = await supertest(server.server)
      .post(`/api/diet-plans/${dietPlanId}/meals/${mealId}/foods`)
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ foodId: frangoId, quantity: 2 });
    expect(r1.status).toBe(201);

    const r2 = await supertest(server.server)
      .post(`/api/diet-plans/${dietPlanId}/meals/${mealId}/foods`)
      .set("Authorization", `Bearer ${nutriToken}`)
      .send({ foodId: arrozId, quantity: 1 });
    expect(r2.status).toBe(201);
  });

  it("GET /api/diet-plans/:id agrega os macros corretamente (frango x2 + arroz x1)", async () => {
    const r = await supertest(server.server)
      .get(`/api/diet-plans/${dietPlanId}`)
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(r.status).toBe(200);

    // Frango (100g): 31P/0C/3.6G/165kcal x2 = 62/0/7.2/330
    // Arroz (100g):  2.7P/28C/0.3G/130kcal x1 = 2.7/28/0.3/130
    // Soma esperada: 64.7P / 28C / 7.5G / 460kcal
    const meal = r.body.plan.meals[0];
    expect(meal.macros.proteinG).toBeCloseTo(64.7, 1);
    expect(meal.macros.carbsG).toBeCloseTo(28, 1);
    expect(meal.macros.fatG).toBeCloseTo(7.5, 1);
    expect(meal.macros.kcal).toBeCloseTo(460, 1);

    // Total do dia == soma das refeições (só há 1 refeição aqui, deve bater igual)
    expect(r.body.plan.totalMacros.proteinG).toBeCloseTo(64.7, 1);
    expect(r.body.plan.totalMacros.kcal).toBeCloseTo(460, 1);
  });

  it("o aluno dono também consegue ver o próprio plano", async () => {
    const r = await supertest(server.server)
      .get(`/api/diet-plans/${dietPlanId}`)
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
  });

  it("um usuário não relacionado ao plano recebe 403", async () => {
    const loginOutro = await supertest(server.server)
      .post("/api/auth/login")
      .send({ email: "test_nutrimod_aluno2@thunderafit.test", password: "SenhaSegura@123" });
    const r = await supertest(server.server)
      .get(`/api/diet-plans/${dietPlanId}`)
      .set("Authorization", `Bearer ${loginOutro.body.accessToken}`);
    expect(r.status).toBe(403);
  });
});

describe("GET /api/diet-plans", () => {
  it("aluno vê o próprio plano na listagem", async () => {
    const r = await supertest(server.server)
      .get("/api/diet-plans")
      .set("Authorization", `Bearer ${alunoToken}`);
    expect(r.status).toBe(200);
    expect(r.body.plans.some((p: any) => p.id === dietPlanId)).toBe(true);
  });

  it("nutricionista vê o plano que criou", async () => {
    const r = await supertest(server.server)
      .get("/api/diet-plans")
      .set("Authorization", `Bearer ${nutriToken}`);
    expect(r.status).toBe(200);
    expect(r.body.plans.some((p: any) => p.id === dietPlanId)).toBe(true);
  });
});
