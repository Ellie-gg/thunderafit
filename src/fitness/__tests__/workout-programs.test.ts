import supertest from "supertest";
import { buildApp } from "../../app";
import prisma from "../../lib/prisma";
import { computeSuggestedSessionId } from "../services/workout-programs.service";

let server: import("fastify").FastifyInstance;
let personalToken: string;
let personalId: string;
let aluno1Id: string;
let aluno2Id: string;
let aluno1Token: string;
// Fase 41: alunos extras só pra evitar colisão com a regra nova de "1
// programa aplicado por aluno, por Personal" — cada describe block que
// precisa aplicar MAIS UM programa a partir do mesmo personalId usa um
// aluno dedicado, em vez de reaproveitar aluno1Id/aluno2Id (que já têm
// programa aplicado desde o bloco 2).
let aluno3Id: string;
let aluno3Token: string;
let aluno4Id: string;
let aluno5Id: string;
let aluno5Token: string;
let exerciseIds: string[];

const pw = "SenhaSegura@123";

beforeAll(async () => {
  server = await buildApp();
  await server.ready();
  await prisma.$connect();

  const regP = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "wp_personal@thunderafit.test", password: pw, role: "PERSONAL" });
  personalId = regP.body.user.id;
  const regA1 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "wp_aluno1@thunderafit.test", password: pw, role: "ALUNO" });
  aluno1Id = regA1.body.user.id;
  const regA2 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "wp_aluno2@thunderafit.test", password: pw, role: "ALUNO" });
  aluno2Id = regA2.body.user.id;
  const regA3 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "wp_aluno3@thunderafit.test", password: pw, role: "ALUNO" });
  aluno3Id = regA3.body.user.id;
  const regA4 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "wp_aluno4@thunderafit.test", password: pw, role: "ALUNO" });
  aluno4Id = regA4.body.user.id;
  const regA5 = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email: "wp_aluno5@thunderafit.test", password: pw, role: "ALUNO" });
  aluno5Id = regA5.body.user.id;

  personalToken = (
    await supertest(server.server).post("/api/auth/login").send({ email: "wp_personal@thunderafit.test", password: pw })
  ).body.accessToken;
  aluno1Token = (
    await supertest(server.server).post("/api/auth/login").send({ email: "wp_aluno1@thunderafit.test", password: pw })
  ).body.accessToken;
  aluno3Token = (
    await supertest(server.server).post("/api/auth/login").send({ email: "wp_aluno3@thunderafit.test", password: pw })
  ).body.accessToken;
  aluno5Token = (
    await supertest(server.server).post("/api/auth/login").send({ email: "wp_aluno5@thunderafit.test", password: pw })
  ).body.accessToken;

  // Fase 41: precisa vincular 5 alunos de teste (3 a mais do que antes, pra
  // evitar colisão com a regra nova de "1 programa aplicado por aluno, por
  // Personal") — acima do limite freemium padrão (3), então sobe o limite
  // só pra este Personal de teste.
  await prisma.user.update({ where: { id: personalId }, data: { limiteAlunos: 10 } });

  for (const alunoId of [aluno1Id, aluno2Id, aluno3Id, aluno4Id, aluno5Id]) {
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId });
  }

  const exs = await prisma.exercise.findMany({ take: 3, orderBy: { name: "asc" } });
  exerciseIds = exs.map((e) => e.id);
});

afterAll(async () => {
  // Limpa em ordem de dependência (setlog -> workoutExercise -> workout -> program).
  const progs = await prisma.workoutProgram.findMany({ where: { personalId }, select: { id: true } });
  const progIds = progs.map((p) => p.id);
  const workouts = await prisma.workout.findMany({ where: { programId: { in: progIds } }, select: { id: true } });
  const wIds = workouts.map((w) => w.id);
  const wes = await prisma.workoutExercise.findMany({ where: { workoutId: { in: wIds } }, select: { id: true } });
  await prisma.setLog.deleteMany({ where: { workoutExerciseId: { in: wes.map((w) => w.id) } } });
  await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: wIds } } });
  await prisma.workout.deleteMany({ where: { programId: { in: progIds } } });
  await prisma.workoutProgram.deleteMany({ where: { personalId } });
  await prisma.clientRelation.deleteMany({ where: { personalId } });
  await prisma.user.deleteMany({ where: { email: { contains: "wp_" } } });
  await prisma.$disconnect();
  await server.close();
});

describe("Fase 16 — cálculo de suggestedNext (regra unitária)", () => {
  it("sugere a de MENOR letra nunca feita", () => {
    const id = computeSuggestedSessionId([
      { id: "A", letter: "A", lastCompletedAt: new Date("2026-01-01") },
      { id: "B", letter: "B", lastCompletedAt: null },
      { id: "C", letter: "C", lastCompletedAt: null },
    ]);
    expect(id).toBe("B");
  });

  it("todas feitas: sugere a de conclusão mais antiga", () => {
    const id = computeSuggestedSessionId([
      { id: "A", letter: "A", lastCompletedAt: new Date("2026-03-10") },
      { id: "B", letter: "B", lastCompletedAt: new Date("2026-01-05") },
      { id: "C", letter: "C", lastCompletedAt: new Date("2026-02-20") },
    ]);
    expect(id).toBe("B");
  });

  it("programa sem sessões: null", () => {
    expect(computeSuggestedSessionId([])).toBeNull();
  });

  it("esquema WEEKDAY: sugere SEMPRE a sessão do dia da semana de hoje, não o round-robin do LETTER (Fase 39)", () => {
    // 2026-07-22 é uma quarta-feira.
    const id = computeSuggestedSessionId(
      [
        { id: "seg", letter: "SEGUNDA", lastCompletedAt: null },
        { id: "qua", letter: "QUARTA", lastCompletedAt: null },
      ],
      "WEEKDAY",
      new Date("2026-07-22T12:00:00.000Z")
    );
    expect(id).toBe("qua");
  });

  it("esquema WEEKDAY: ignora histórico de conclusão — mesmo com QUARTA já feita e SEGUNDA nunca feita, hoje sendo quarta sugere QUARTA", () => {
    const id = computeSuggestedSessionId(
      [
        { id: "seg", letter: "SEGUNDA", lastCompletedAt: null },
        { id: "qua", letter: "QUARTA", lastCompletedAt: new Date("2026-07-15") },
      ],
      "WEEKDAY",
      new Date("2026-07-22T12:00:00.000Z")
    );
    expect(id).toBe("qua");
  });

  it("esquema WEEKDAY: sem sessão cadastrada pro dia de hoje, não sugere nada (null)", () => {
    // 2026-07-25 é um sábado; programa só tem Segunda a Sexta.
    const id = computeSuggestedSessionId(
      [
        { id: "seg", letter: "SEGUNDA", lastCompletedAt: null },
        { id: "sex", letter: "SEXTA", lastCompletedAt: null },
      ],
      "WEEKDAY",
      new Date("2026-07-25T12:00:00.000Z")
    );
    expect(id).toBeNull();
  });
});

describe("Fase 16 BLOCO 2 — template, sessões e aplicação (cópia)", () => {
  let templateId: string;

  it("cria template (isTemplate=true, sem alunoId)", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Masculino Avançado ABC" });
    expect(r.status).toBe(201);
    expect(r.body.program.isTemplate).toBe(true);
    expect(r.body.program.alunoId).toBeNull();
    templateId = r.body.program.id;
  });

  it("adiciona 3 sessões (A, B, C) com exercícios", async () => {
    for (const letter of ["A", "B", "C"]) {
      const s = await supertest(server.server)
        .post(`/api/workout-programs/${templateId}/sessions`)
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ letter, name: `Sessão ${letter}` });
      expect(s.status).toBe(201);
      // adiciona 1 exercício em cada sessão (reutiliza POST /api/workouts/:id/exercises)
      await supertest(server.server)
        .post(`/api/workouts/${s.body.session.id}/exercises`)
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ exerciseId: exerciseIds[0], sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });
    }
  });

  it("rejeita 4ª sessão repetida (letra A já existe) com 409", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateId}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });
    expect(r.status).toBe(409);
  });

  it("aplica o template a 2 alunos → cria cópias independentes com alunoId preenchido", async () => {
    for (const alunoId of [aluno1Id, aluno2Id]) {
      const r = await supertest(server.server)
        .post(`/api/workout-programs/${templateId}/apply`)
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ alunoId });
      expect(r.status).toBe(201);
      expect(r.body.program.isTemplate).toBe(false);
      expect(r.body.program.alunoId).toBe(alunoId);
      expect(r.body.program.id).not.toBe(templateId);
      expect(r.body.program.workouts).toHaveLength(3);
    }
  });

  it("Fase 41: mesmo Personal tentando aplicar OUTRO programa ao mesmo aluno recebe 409 (já tem um aplicado)", async () => {
    const outroTemplate = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Segundo Programa" });

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${outroTemplate.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: aluno1Id });

    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/já tem o programa/);
  });

  it("Fase 41: um aluno pode ter mais de um Personal — cada um pode aplicar o SEU próprio programa ao mesmo aluno", async () => {
    const outroPersonal = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_outro_personal_multi@thunderafit.test", password: pw, role: "PERSONAL" });
    const outroPersonalToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_outro_personal_multi@thunderafit.test", password: pw })
    ).body.accessToken;

    // Vincula o mesmo aluno1 a este segundo Personal (aluno com 2 Personals).
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${outroPersonalToken}`)
      .send({ alunoId: aluno1Id });

    const seuProprioTemplate = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${outroPersonalToken}`)
      .send({ name: "Programa do Segundo Personal" });
    for (const letter of ["A"]) {
      await supertest(server.server)
        .post(`/api/workout-programs/${seuProprioTemplate.body.program.id}/sessions`)
        .set("Authorization", `Bearer ${outroPersonalToken}`)
        .send({ letter });
    }

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${seuProprioTemplate.body.program.id}/apply`)
      .set("Authorization", `Bearer ${outroPersonalToken}`)
      .send({ alunoId: aluno1Id });

    // aluno1Id JÁ tem um programa aplicado pelo personalId original — mas
    // este é um Personal DIFERENTE, então não deve ser bloqueado.
    expect(r.status).toBe(201);

    await prisma.setLog.deleteMany({
      where: { workoutExercise: { workout: { program: { personalId: outroPersonal.body.user.id } } } },
    });
    await prisma.workoutExercise.deleteMany({
      where: { workout: { program: { personalId: outroPersonal.body.user.id } } },
    });
    await prisma.workout.deleteMany({ where: { program: { personalId: outroPersonal.body.user.id } } });
    await prisma.workoutProgram.deleteMany({ where: { personalId: outroPersonal.body.user.id } });
    await prisma.clientRelation.deleteMany({ where: { personalId: outroPersonal.body.user.id } });
    await prisma.user.deleteMany({ where: { email: "wp_outro_personal_multi@thunderafit.test" } });
  });

  it("aplicar a um aluno NÃO vinculado retorna 403", async () => {
    const outro = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_naovinc@thunderafit.test", password: pw, role: "ALUNO" });
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${templateId}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: outro.body.user.id });
    expect(r.status).toBe(403);
    await prisma.user.deleteMany({ where: { email: "wp_naovinc@thunderafit.test" } });
  });

  it("CÓPIA, não referência: editar o template depois NÃO altera as instâncias já aplicadas", async () => {
    // Estado das instâncias ANTES da edição: cada aluno tem 3 sessões.
    const instAntes = await prisma.workoutProgram.findMany({
      where: { personalId, isTemplate: false, alunoId: { in: [aluno1Id, aluno2Id] } },
      include: { workouts: true },
    });
    expect(instAntes).toHaveLength(2);
    expect(instAntes.every((p) => p.workouts.length === 3)).toBe(true);

    // Edita o TEMPLATE: adiciona uma 4ª sessão (D).
    const add = await supertest(server.server)
      .post(`/api/workout-programs/${templateId}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "D", name: "Sessão D nova" });
    expect(add.status).toBe(201);

    // Template agora tem 4 sessões...
    const tpl = await prisma.workoutProgram.findUnique({
      where: { id: templateId },
      include: { workouts: true },
    });
    expect(tpl!.workouts).toHaveLength(4);

    // ...mas as instâncias dos 2 alunos CONTINUAM com 3 (não retroagiu).
    const instDepois = await prisma.workoutProgram.findMany({
      where: { personalId, isTemplate: false, alunoId: { in: [aluno1Id, aluno2Id] } },
      include: { workouts: true },
    });
    expect(instDepois.every((p) => p.workouts.length === 3)).toBe(true);
  });

  it("GET /api/workout-programs?type=template lista só templates", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs?type=template")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.every((p: any) => p.isTemplate === true)).toBe(true);
    expect(r.body.programs.some((p: any) => p.id === templateId)).toBe(true);
  });

  // Fase 29 (hub do aluno): filtro opcional ?alunoId= — só as instâncias
  // aplicadas àquele aluno, nunca as de outro aluno (mesmo Personal) nem
  // templates (alunoId=null nunca bate com o filtro).
  it("GET /api/workout-programs?alunoId= retorna só as instâncias daquele aluno, nunca de outro", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs?alunoId=${aluno1Id}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.length).toBeGreaterThanOrEqual(1);
    expect(r.body.programs.every((p: any) => p.alunoId === aluno1Id)).toBe(true);
    expect(r.body.programs.some((p: any) => p.alunoId === aluno2Id)).toBe(false);
    expect(r.body.programs.some((p: any) => p.isTemplate)).toBe(false);
  });

  it("GET /api/workout-programs?type=instance&alunoId= compõe os dois filtros", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs?type=instance&alunoId=${aluno1Id}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.every((p: any) => p.alunoId === aluno1Id && p.isTemplate === false)).toBe(true);
  });
});

describe("Fase 16 BLOCO 3 — concluir sessão + suggestedNext ponta a ponta", () => {
  let programId: string;
  let sessions: any[];

  beforeAll(async () => {
    // Cria um template fresco de 3 sessões e aplica ao aluno1.
    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Programa Progresso" });
    for (const letter of ["A", "B", "C"]) {
      await supertest(server.server)
        .post(`/api/workout-programs/${tpl.body.program.id}/sessions`)
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ letter });
    }
    const applied = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: aluno3Id });
    programId = applied.body.program.id;
    sessions = applied.body.program.workouts.sort((a: any, b: any) => a.letter.localeCompare(b.letter));
  });

  it("sem nenhuma conclusão, sugere a sessão A", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs/${programId}`)
      .set("Authorization", `Bearer ${aluno3Token}`);
    expect(r.status).toBe(200);
    const suggested = r.body.program.workouts.filter((w: any) => w.suggestedNext);
    expect(suggested).toHaveLength(1);
    expect(suggested[0].letter).toBe("A");
  });

  it("aluno conclui a sessão B (fora de ordem) → sugestão passa a ser A (menor nunca feita)", async () => {
    const sessionB = sessions.find((s: any) => s.letter === "B");
    const c = await supertest(server.server)
      .post(`/api/workouts/${sessionB.id}/complete`)
      .set("Authorization", `Bearer ${aluno3Token}`);
    expect(c.status).toBe(200);
    expect(c.body.workout.lastCompletedAt).not.toBeNull();

    const r = await supertest(server.server)
      .get(`/api/workout-programs/${programId}`)
      .set("Authorization", `Bearer ${aluno3Token}`);
    const suggested = r.body.program.workouts.filter((w: any) => w.suggestedNext);
    expect(suggested).toHaveLength(1);
    // A e C nunca feitas; a de menor letra é A.
    expect(suggested[0].letter).toBe("A");
  });

  it("após concluir A e C também, sugere a de conclusão mais antiga (B foi a primeira)", async () => {
    for (const letter of ["A", "C"]) {
      const s = sessions.find((x: any) => x.letter === letter);
      await supertest(server.server)
        .post(`/api/workouts/${s.id}/complete`)
        .set("Authorization", `Bearer ${aluno3Token}`);
    }
    const r = await supertest(server.server)
      .get(`/api/workout-programs/${programId}`)
      .set("Authorization", `Bearer ${aluno3Token}`);
    const suggested = r.body.program.workouts.filter((w: any) => w.suggestedNext);
    expect(suggested).toHaveLength(1);
    expect(suggested[0].letter).toBe("B");
  });

  it("Personal não pode concluir sessão do aluno (403)", async () => {
    const sessionA = sessions.find((s: any) => s.letter === "A");
    const r = await supertest(server.server)
      .post(`/api/workouts/${sessionA.id}/complete`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(403);
  });
});

describe("Fase 26 — esquema de sessão WEEKDAY (dias da semana)", () => {
  let weekdayTemplateId: string;

  it("cria programa com sessionScheme=WEEKDAY", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Programa Semanal", sessionScheme: "WEEKDAY" });
    expect(r.status).toBe(201);
    expect(r.body.program.sessionScheme).toBe("WEEKDAY");
    weekdayTemplateId = r.body.program.id;
  });

  it("rejeita letra A-E num programa WEEKDAY (400)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${weekdayTemplateId}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });
    expect(r.status).toBe(400);
  });

  it("adiciona QUARTA e depois SEGUNDA (fora de ordem alfabética e de inserção)", async () => {
    for (const letter of ["QUARTA", "SEGUNDA"]) {
      const r = await supertest(server.server)
        .post(`/api/workout-programs/${weekdayTemplateId}/sessions`)
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ letter });
      expect(r.status).toBe(201);
    }
  });

  it("GET do programa ordena por calendário (SEGUNDA antes de QUARTA), mesmo tendo sido criada depois", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs/${weekdayTemplateId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.program.workouts.map((w: any) => w.letter)).toEqual(["SEGUNDA", "QUARTA"]);
  });


  it("rejeita a 8ª sessão (máximo de 7 dias)", async () => {
    for (const letter of ["TERCA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"]) {
      const r = await supertest(server.server)
        .post(`/api/workout-programs/${weekdayTemplateId}/sessions`)
        .set("Authorization", `Bearer ${personalToken}`)
        .send({ letter });
      expect(r.status).toBe(201);
    }
    // As 7 já existem — qualquer dia novo esbarra no limite antes da checagem de duplicata.
    const tpl = await prisma.workoutProgram.findUnique({
      where: { id: weekdayTemplateId },
      include: { workouts: true },
    });
    expect(tpl!.workouts).toHaveLength(7);
  });

  it("GET do programa sugere a sessão do dia da semana de HOJE (Fase 39), não round-robin — com a semana completa, hoje sempre tem sessão", async () => {
    const WEEKDAY_ORDER = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"];
    const todayKey = WEEKDAY_ORDER[(new Date().getUTCDay() + 6) % 7];

    const r = await supertest(server.server)
      .get(`/api/workout-programs/${weekdayTemplateId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    const suggested = r.body.program.workouts.filter((w: any) => w.suggestedNext);
    expect(suggested).toHaveLength(1);
    expect(suggested[0].letter).toBe(todayKey);
  });

  it("aplicar a um aluno preserva o sessionScheme=WEEKDAY na cópia", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${weekdayTemplateId}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: aluno4Id });
    expect(r.status).toBe(201);
    expect(r.body.program.sessionScheme).toBe("WEEKDAY");
    expect(r.body.program.workouts).toHaveLength(7);
  });
});

describe("Fase 31 — excluir programa (template ou instância aplicada)", () => {
  let deletableTemplateId: string;
  let deletableInstanceId: string;
  let instanceSessionId: string;
  let instanceWorkoutExerciseId: string;

  it("cria um template com 1 sessão + 1 exercício, aplica a um aluno, e o aluno registra uma série real", async () => {
    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Programa Descartável" });
    deletableTemplateId = tpl.body.program.id;

    const session = await supertest(server.server)
      .post(`/api/workout-programs/${deletableTemplateId}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });
    await supertest(server.server)
      .post(`/api/workouts/${session.body.session.id}/exercises`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ exerciseId: exerciseIds[0], sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });

    const applied = await supertest(server.server)
      .post(`/api/workout-programs/${deletableTemplateId}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: aluno5Id });
    deletableInstanceId = applied.body.program.id;
    instanceSessionId = applied.body.program.workouts[0].id;
    instanceWorkoutExerciseId = applied.body.program.workouts[0].exercises[0].id;

    const log = await supertest(server.server)
      .post(`/api/workouts/${instanceSessionId}/exercises/${instanceWorkoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${aluno5Token}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 50 });
    expect(log.status).toBe(201);
  });

  it("outro Personal não pode excluir (403), e o programa continua existindo", async () => {
    const outro = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_outro_personal@thunderafit.test", password: pw, role: "PERSONAL" });
    const outroToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_outro_personal@thunderafit.test", password: pw })
    ).body.accessToken;

    const r = await supertest(server.server)
      .delete(`/api/workout-programs/${deletableTemplateId}`)
      .set("Authorization", `Bearer ${outroToken}`);
    expect(r.status).toBe(403);

    const stillThere = await prisma.workoutProgram.findUnique({ where: { id: deletableTemplateId } });
    expect(stillThere).not.toBeNull();
    await prisma.user.deleteMany({ where: { email: "wp_outro_personal@thunderafit.test" } });
  });

  it("id inexistente retorna 404", async () => {
    const r = await supertest(server.server)
      .delete("/api/workout-programs/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(404);
  });

  it("dono exclui o TEMPLATE → 204, sessão e exercício somem, mas a INSTÂNCIA aplicada (cópia independente) continua intacta", async () => {
    const r = await supertest(server.server)
      .delete(`/api/workout-programs/${deletableTemplateId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(204);

    expect(await prisma.workoutProgram.findUnique({ where: { id: deletableTemplateId } })).toBeNull();

    // A instância aplicada é uma CÓPIA (Fase 16) — apagar o template de origem
    // não deve afetar a cópia que o aluno já recebeu.
    const instance = await prisma.workoutProgram.findUnique({
      where: { id: deletableInstanceId },
      include: { workouts: { include: { exercises: { include: { setLogs: true } } } } },
    });
    expect(instance).not.toBeNull();
    expect(instance!.workouts).toHaveLength(1);
    expect(instance!.workouts[0].exercises[0].setLogs).toHaveLength(1);
  });

  it("dono exclui a INSTÂNCIA aplicada → 204, e a sessão/exercício/SetLog real do aluno somem junto", async () => {
    const r = await supertest(server.server)
      .delete(`/api/workout-programs/${deletableInstanceId}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(204);

    expect(await prisma.workoutProgram.findUnique({ where: { id: deletableInstanceId } })).toBeNull();
    expect(await prisma.workout.findUnique({ where: { id: instanceSessionId } })).toBeNull();
    expect(
      await prisma.workoutExercise.findUnique({ where: { id: instanceWorkoutExerciseId } })
    ).toBeNull();
    expect(
      await prisma.setLog.findMany({ where: { workoutExerciseId: instanceWorkoutExerciseId } })
    ).toHaveLength(0);

    // Não afetou outros programas do mesmo Personal (ex: o template WEEKDAY
    // criado no bloco de testes acima, "Programa Semanal").
    expect(
      await prisma.workoutProgram.findFirst({ where: { personalId, name: "Programa Semanal" } })
    ).not.toBeNull();
  });
});
