import supertest from "supertest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Limpar usuários de teste
  await prisma.user.deleteMany({ where: { email: { contains: "test_" } } });
});

afterAll(async () => {
  // Limpar usuários criados nos testes
  await prisma.user.deleteMany({ where: { email: { contains: "test_" } } });
  await app.close();
  await prisma.$disconnect();
});

const TEST_EMAIL = "test_personal@thunderafit.test";
const TEST_PASSWORD = "SenhaSegura@123";

// ---------------------------------------------------------------
// 1. Registro com dados válidos retorna 201 e planoAssinatura FREE
// ---------------------------------------------------------------
describe("POST /api/auth/register", () => {
  it("deve criar um Personal Trainer com planoAssinatura FREE e retornar 201", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, role: "PERSONAL" });

    expect(response.status).toBe(201);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(TEST_EMAIL);
    expect(response.body.user.role).toBe("PERSONAL");
    expect(response.body.user.planoAssinatura).toBe("FREE");
    expect(response.body.user.limiteAlunos).toBe(3);

    // Campos sensíveis NÃO devem aparecer na resposta
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.refreshTokenHash).toBeUndefined();
  });

  it("Fase 39: cadastro com name grava e retorna o nome", async () => {
    const email = "test_com_nome@thunderafit.test";
    const response = await supertest(app.server)
      .post("/api/auth/register")
      .send({ email, password: TEST_PASSWORD, role: "ALUNO", name: "  Maria Silva  " });

    expect(response.status).toBe(201);
    // trim aplicado no controller.
    expect(response.body.user.name).toBe("Maria Silva");
  });

  it("Fase 39: cadastro SEM name continua funcionando (API não exige, só o form real exige) — name fica null", async () => {
    const email = "test_sem_nome@thunderafit.test";
    const response = await supertest(app.server)
      .post("/api/auth/register")
      .send({ email, password: TEST_PASSWORD, role: "ALUNO" });

    expect(response.status).toBe(201);
    expect(response.body.user.name).toBeNull();
  });

  it("deve retornar 409 ao tentar registrar um e-mail já existente", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, role: "PERSONAL" });

    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------
// 2. Login com credenciais corretas retorna 200 com tokens
// ---------------------------------------------------------------
describe("POST /api/auth/login", () => {
  let accessToken: string;
  let refreshToken: string;

  it("deve retornar 200 com accessToken e refreshToken para credenciais válidas", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.user).toBeDefined();
    expect(response.body.user.passwordHash).toBeUndefined();

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  // ---------------------------------------------------------------
  // 3. Login com senha errada retorna 401
  // ---------------------------------------------------------------
  it("deve retornar 401 com senha incorreta", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "SenhaErrada@999" });

    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------
  // 4. Acesso a rota protegida sem token retorna 401
  // ---------------------------------------------------------------
  it("deve retornar 401 ao acessar rota protegida sem token", async () => {
    const response = await supertest(app.server)
      .get("/api/auth/protected");

    expect(response.status).toBe(401);
  });

  it("deve retornar 200 ao acessar rota protegida com token válido", async () => {
    // Precisamos garantir que accessToken foi obtido — re-login se necessário
    let token = accessToken;
    if (!token) {
      const loginRes = await supertest(app.server)
        .post("/api/auth/login")
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      token = loginRes.body.accessToken;
    }

    const response = await supertest(app.server)
      .get("/api/auth/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  // ---------------------------------------------------------------
  // 5. Refresh com token inválido retorna 401
  // ---------------------------------------------------------------
  it("deve retornar 401 ao tentar refresh com token inválido", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/refresh")
      .send({ refreshToken: "token.invalido.aqui" });

    expect(response.status).toBe(401);
  });

  it("deve retornar novo accessToken ao usar refreshToken válido", async () => {
    // Garantir que temos um refreshToken
    let rToken = refreshToken;
    if (!rToken) {
      const loginRes = await supertest(app.server)
        .post("/api/auth/login")
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      rToken = loginRes.body.refreshToken;
    }

    const response = await supertest(app.server)
      .post("/api/auth/refresh")
      .send({ refreshToken: rToken });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });
});

// ---------------------------------------------------------------
// 6. Cookies httpOnly (Fase 5.5)
// ---------------------------------------------------------------
describe("Cookies httpOnly", () => {
  const cookieEmail = "test_cookie_user@thunderafit.test";

  beforeAll(async () => {
    await supertest(app.server)
      .post("/api/auth/register")
      .send({ email: cookieEmail, password: TEST_PASSWORD, role: "ALUNO" });
  });

  it("login seta access_token e refresh_token como cookies HttpOnly", async () => {
    const response = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: cookieEmail, password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    const setCookie = response.headers["set-cookie"] as unknown as string[];
    expect(setCookie).toBeDefined();

    const accessCookie = setCookie.find((c) => c.startsWith("access_token="));
    const refreshCookie = setCookie.find((c) => c.startsWith("refresh_token="));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it("aceita o access token vindo apenas do cookie (sem header Authorization)", async () => {
    const loginRes = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: cookieEmail, password: TEST_PASSWORD });

    const setCookie = loginRes.headers["set-cookie"] as unknown as string[];
    const accessCookie = setCookie.find((c) => c.startsWith("access_token="))!.split(";")[0];

    const response = await supertest(app.server)
      .get("/api/auth/protected")
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);
  });

  it("aceita o refresh vindo do cookie quando o corpo não traz refreshToken", async () => {
    const loginRes = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: cookieEmail, password: TEST_PASSWORD });

    const setCookie = loginRes.headers["set-cookie"] as unknown as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith("refresh_token="))!.split(";")[0];

    const response = await supertest(app.server)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
  });

  it("logout limpa os cookies e invalida o refresh token no banco", async () => {
    const loginRes = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: cookieEmail, password: TEST_PASSWORD });

    const accessToken = loginRes.body.accessToken;
    const refreshToken = loginRes.body.refreshToken;

    const logoutRes = await supertest(app.server)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);
    const setCookie = logoutRes.headers["set-cookie"] as unknown as string[];
    expect(setCookie.some((c) => c.startsWith("access_token=;"))).toBe(true);
    expect(setCookie.some((c) => c.startsWith("refresh_token=;"))).toBe(true);

    // O refresh token antigo deve ter sido invalidado no banco pelo logout
    const refreshAfterLogout = await supertest(app.server)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe("PUT /api/auth/me/avatar (Fase 30)", () => {
  const email = "test_avatar_user@thunderafit.test";
  const password = "SenhaSegura@123";
  // 1x1 PNG válido (menor imagem real possível) em base64 — testa o
  // caminho feliz sem depender de arquivo externo.
  const TINY_PNG_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  let token: string;

  beforeAll(async () => {
    await supertest(app.server)
      .post("/api/auth/register")
      .send({ email, password, role: "ALUNO" });
    const login = await supertest(app.server).post("/api/auth/login").send({ email, password });
    token = login.body.accessToken;
  });

  it("sem autenticação retorna 401", async () => {
    const r = await supertest(app.server)
      .put("/api/auth/me/avatar")
      .send({ avatarDataUrl: TINY_PNG_DATA_URL });
    expect(r.status).toBe(401);
  });

  it("sem o campo avatarDataUrl no body retorna 400", async () => {
    const r = await supertest(app.server)
      .put("/api/auth/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(r.status).toBe(400);
  });

  it("formato inválido (não é data URI de imagem) retorna 400", async () => {
    const r = await supertest(app.server)
      .put("/api/auth/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarDataUrl: "not-an-image" });
    expect(r.status).toBe(400);
  });

  it("imagem grande demais (acima do limite) retorna 400", async () => {
    const huge = "data:image/png;base64," + "A".repeat(150_000);
    const r = await supertest(app.server)
      .put("/api/auth/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarDataUrl: huge });
    expect(r.status).toBe(400);
  });

  it("aceita uma imagem PNG pequena válida e persiste", async () => {
    const r = await supertest(app.server)
      .put("/api/auth/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarDataUrl: TINY_PNG_DATA_URL });
    expect(r.status).toBe(200);
    expect(r.body.user.avatarUrl).toBe(TINY_PNG_DATA_URL);
    expect(r.body.user.passwordHash).toBeUndefined();
    expect(r.body.user.refreshTokenHash).toBeUndefined();

    // Persistiu de verdade — login de novo confirma via o campo do usuário.
    const login = await supertest(app.server).post("/api/auth/login").send({ email, password });
    expect(login.body.user.avatarUrl).toBe(TINY_PNG_DATA_URL);
  });

  it("avatarDataUrl: null remove o avatar", async () => {
    const r = await supertest(app.server)
      .put("/api/auth/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarDataUrl: null });
    expect(r.status).toBe(200);
    expect(r.body.user.avatarUrl).toBeNull();
  });
});
