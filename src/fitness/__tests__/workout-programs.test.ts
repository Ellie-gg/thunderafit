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
}, 30000);

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

describe("Fase 34 — origin (PERSONAL | SELF) em WorkoutProgram", () => {
  it("todo programa criado pelo Personal tem origin: PERSONAL por padrão", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Programa Fase 34" });
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("PERSONAL");
  });

  it("listByPersonal nunca retorna um programa origin: SELF, mesmo inserido diretamente no banco", async () => {
    // Simula um template SELF (curado pelo admin, Fase 34.5) — sem
    // personalId, origin explícito SELF. Como não existe endpoint de
    // criação ainda nesta fase, insere direto via Prisma.
    const selfTemplate = await prisma.workoutProgram.create({
      data: { name: "Template SELF de teste", origin: "SELF", personalId: null, isTemplate: true },
    });

    const r = await supertest(server.server)
      .get("/api/workout-programs?type=template")
      .set("Authorization", `Bearer ${personalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.some((p: any) => p.id === selfTemplate.id)).toBe(false);

    await prisma.workoutProgram.delete({ where: { id: selfTemplate.id } });
  });

  it("Personal não consegue aplicar (POST /apply) um programa origin: SELF, mesmo tentando o id diretamente", async () => {
    const selfTemplate = await prisma.workoutProgram.create({
      data: { name: "Template SELF pra tentar aplicar", origin: "SELF", personalId: null, isTemplate: true },
    });

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${selfTemplate.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: aluno2Id });
    expect(r.status).toBe(403);

    await prisma.workoutProgram.delete({ where: { id: selfTemplate.id } });
  });

  it("Personal não consegue adicionar sessão nem excluir um programa origin: SELF", async () => {
    const selfTemplate = await prisma.workoutProgram.create({
      data: { name: "Template SELF pra tentar editar", origin: "SELF", personalId: null, isTemplate: true },
    });

    const addSession = await supertest(server.server)
      .post(`/api/workout-programs/${selfTemplate.id}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });
    expect(addSession.status).toBe(403);

    const del = await supertest(server.server)
      .delete(`/api/workout-programs/${selfTemplate.id}`)
      .set("Authorization", `Bearer ${personalToken}`);
    expect(del.status).toBe(403);

    await prisma.workoutProgram.delete({ where: { id: selfTemplate.id } });
  });

  it("Workout.personalId também é nullable (sessão de um programa SELF não viola NOT NULL)", async () => {
    const selfTemplate = await prisma.workoutProgram.create({
      data: { name: "Template SELF com sessão", origin: "SELF", personalId: null, isTemplate: true },
    });
    const selfWorkout = await prisma.workout.create({
      data: { programId: selfTemplate.id, personalId: null, alunoId: null, name: "Sessão A", letter: "A" },
    });
    expect(selfWorkout.personalId).toBeNull();

    await prisma.workout.delete({ where: { id: selfWorkout.id } });
    await prisma.workoutProgram.delete({ where: { id: selfTemplate.id } });
  });
});

// Fase 62: alunos DEDICADOS pros testes abaixo — todos os 5 alunos
// compartilhados do topo do arquivo (aluno1..5) já têm um programa aplicado
// por `personalId` em blocos anteriores (a regra de "1 programa aplicado
// por aluno, por Personal" bloquearia um novo apply com 409). Mesmo padrão
// já usado no resto do arquivo (ex: "outro Personal" com registro próprio).
async function criarAlunoVinculado(email: string) {
  const reg = await supertest(server.server)
    .post("/api/auth/register")
    .send({ email, password: pw, role: "ALUNO" });
  await supertest(server.server)
    .post("/api/relations")
    .set("Authorization", `Bearer ${personalToken}`)
    .send({ alunoId: reg.body.user.id });
  return reg.body.user.id as string;
}

describe("Fase 62 — apply() exige template (instância não vai direto pra outro aluno)", () => {
  it("aplicar uma INSTÂNCIA (isTemplate: false) a outro aluno retorna 403", async () => {
    const alunoA = await criarAlunoVinculado("wp_fase62_instancia_a@thunderafit.test");
    const alunoB = await criarAlunoVinculado("wp_fase62_instancia_b@thunderafit.test");

    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Fase 62 — template pra virar instância" });
    await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });

    const instance = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoA });
    expect(instance.status).toBe(201);
    expect(instance.body.program.isTemplate).toBe(false);

    // Tenta aplicar a INSTÂNCIA (não o template original) a outro aluno.
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${instance.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoB });
    expect(r.status).toBe(403);
  });
});

describe("Fase 62 — salvar instância como template", () => {
  it("cria template, aplica a um aluno, e salva a instância como um NOVO template reaplicável", async () => {
    const alunoA = await criarAlunoVinculado("wp_fase62_salvar_a@thunderafit.test");
    const alunoB = await criarAlunoVinculado("wp_fase62_salvar_b@thunderafit.test");

    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Fase 62 — origem" });
    await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });

    const instance = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoA });
    expect(instance.status).toBe(201);

    const saved = await supertest(server.server)
      .post(`/api/workout-programs/${instance.body.program.id}/save-as-template`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Fase 62 — salvo como template" });
    expect(saved.status).toBe(201);
    expect(saved.body.program.isTemplate).toBe(true);
    expect(saved.body.program.alunoId).toBeNull();
    expect(saved.body.program.name).toBe("Fase 62 — salvo como template");
    expect(saved.body.program.workouts).toHaveLength(1);

    // Agora o novo template PODE ser aplicado a outro aluno.
    const reapplied = await supertest(server.server)
      .post(`/api/workout-programs/${saved.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: alunoB });
    expect(reapplied.status).toBe(201);
  });

  it("outro Personal não pode salvar como template um programa que não é dele (403)", async () => {
    const outro = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_outro_save_template@thunderafit.test", password: pw, role: "PERSONAL" });
    const outroToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_outro_save_template@thunderafit.test", password: pw })
    ).body.accessToken;

    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Fase 62 — não deveria poder salvar" });

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/save-as-template`)
      .set("Authorization", `Bearer ${outroToken}`)
      .send({ name: "tentativa" });
    expect(r.status).toBe(403);
  });

  it("tentar salvar um TEMPLATE (não uma instância) como template retorna 400", async () => {
    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Fase 62 — já é template" });

    const r = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/save-as-template`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "tentativa" });
    expect(r.status).toBe(400);
  });
});

describe("Fase 62 — catálogo de templates do Personal (Básico + Premium)", () => {
  let basicoTemplateId: string;
  let premiumTemplateId: string;
  let catalogPersonalId: string;
  let catalogPersonalToken: string;
  let catalogAlunoId: string;

  beforeAll(async () => {
    const basico = await prisma.workoutProgram.create({
      data: { name: "Fase 62 — Básico de teste", origin: "PERSONAL_CATALOG", isTemplate: true },
    });
    basicoTemplateId = basico.id;
    await prisma.workout.create({
      data: { programId: basico.id, name: "Sessão A", letter: "A" },
    });

    // Fase 62: "Premium" do Personal reaproveita origin: SELF, category:
    // PREMIUM — nenhum campo/catálogo novo pra esse tier.
    const premium = await prisma.workoutProgram.create({
      data: { name: "Fase 62 — Premium de teste", origin: "SELF", isTemplate: true, category: "PREMIUM" },
    });
    premiumTemplateId = premium.id;
    await prisma.workout.create({
      data: { programId: premium.id, name: "Sessão A", letter: "A" },
    });

    const regP = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_catalogo_personal@thunderafit.test", password: pw, role: "PERSONAL" });
    catalogPersonalId = regP.body.user.id;
    catalogPersonalToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_catalogo_personal@thunderafit.test", password: pw })
    ).body.accessToken;

    const regA = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_catalogo_aluno@thunderafit.test", password: pw, role: "ALUNO" });
    catalogAlunoId = regA.body.user.id;
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${catalogPersonalToken}`)
      .send({ alunoId: catalogAlunoId });
  });

  afterAll(async () => {
    for (const id of [basicoTemplateId, premiumTemplateId]) {
      const workouts = await prisma.workout.findMany({ where: { programId: id }, select: { id: true } });
      await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: workouts.map((w) => w.id) } } });
      await prisma.workout.deleteMany({ where: { programId: id } });
      await prisma.workoutProgram.delete({ where: { id } });
    }
    // ClientRelation não tem FK declarada pro User (sem onDelete cascade) —
    // limpa explicitamente antes de apagar os usuários, mesmo padrão já
    // usado no resto do arquivo pra Personals/alunos criados ad-hoc.
    await prisma.clientRelation.deleteMany({ where: { personalId: catalogPersonalId } });
    await prisma.user.deleteMany({
      where: { email: { in: ["wp_catalogo_personal@thunderafit.test", "wp_catalogo_aluno@thunderafit.test"] } },
    });
  });

  it("GET /api/workout-programs/personal-catalog lista o Básico e o Premium (nunca origin PERSONAL/SELF fora de category PREMIUM)", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs/personal-catalog")
      .set("Authorization", `Bearer ${catalogPersonalToken}`);
    expect(r.status).toBe(200);
    const ids = r.body.programs.map((p: any) => p.id);
    expect(ids).toContain(basicoTemplateId);
    expect(ids).toContain(premiumTemplateId);
    const basicoItem = r.body.programs.find((p: any) => p.id === basicoTemplateId);
    const premiumItem = r.body.programs.find((p: any) => p.id === premiumTemplateId);
    expect(basicoItem.tier).toBe("BASICO");
    expect(premiumItem.tier).toBe("PREMIUM");
  });

  it("aplica um template Básico a um aluno sem checar plano (plano FREE padrão)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/personal-catalog/${basicoTemplateId}/apply`)
      .set("Authorization", `Bearer ${catalogPersonalToken}`)
      .send({ alunoId: catalogAlunoId });
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("PERSONAL");
    expect(r.body.program.personalId).toBe(catalogPersonalId);
    expect(r.body.program.alunoId).toBe(catalogAlunoId);

    await supertest(server.server)
      .delete(`/api/workout-programs/${r.body.program.id}`)
      .set("Authorization", `Bearer ${catalogPersonalToken}`);
  });

  it("aplicar um template Premium com plano FREE/BASE retorna 402 PREMIUM_TEMPLATE_REQUIRED", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/personal-catalog/${premiumTemplateId}/apply`)
      .set("Authorization", `Bearer ${catalogPersonalToken}`)
      .send({ alunoId: catalogAlunoId });
    expect(r.status).toBe(402);
    expect(r.body.code).toBe("PREMIUM_TEMPLATE_REQUIRED");
  });

  it("plano PLUS libera a aplicação do template Premium", async () => {
    await prisma.user.update({ where: { id: catalogPersonalId }, data: { planoAssinatura: "PLUS" } });

    const r = await supertest(server.server)
      .post(`/api/workout-programs/personal-catalog/${premiumTemplateId}/apply`)
      .set("Authorization", `Bearer ${catalogPersonalToken}`)
      .send({ alunoId: catalogAlunoId });
    expect(r.status).toBe(201);
    expect(r.body.program.origin).toBe("PERSONAL");

    await supertest(server.server)
      .delete(`/api/workout-programs/${r.body.program.id}`)
      .set("Authorization", `Bearer ${catalogPersonalToken}`);
  });

  it("aplicar a um aluno não vinculado retorna 403", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/personal-catalog/${basicoTemplateId}/apply`)
      .set("Authorization", `Bearer ${catalogPersonalToken}`)
      .send({ alunoId: aluno1Id });
    expect(r.status).toBe(403);
  });
});

// Perf (Grupo Y, item 99): response schema novo em GET /api/workout-programs/:id
// (fast-json-stringify) funciona como ALLOWLIST de serialização — um campo
// esquecido no schema some da resposta em silêncio, sem erro nenhum. Este
// bloco monta um programa aplicado com sessão + exercício + série real e
// compara as CHAVES de cada nível aninhado contra a lista exata esperada
// (mapeada campo a campo em workout-response-schemas.ts), pra pegar tanto um
// campo que sumiu quanto um campo novo que ninguém lembrou de adicionar ao
// schema no futuro. Reaproveita o `personalId`/`personalToken` compartilhado
// do arquivo — o `afterAll` global (linhas 86-101) já limpa tudo que fica
// sob esse `personalId` (programa, sessão, exercício, série) e todo usuário
// com email contendo "wp_", sem precisar de um afterAll local aqui.
describe("Perf (Grupo Y, item 99) — GET /api/workout-programs/:id não descarta nenhum campo esperado", () => {
  let schemaAlunoToken: string;
  let schemaProgramId: string;

  beforeAll(async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_schema_check@thunderafit.test", password: pw, role: "ALUNO" });
    const schemaAlunoId = reg.body.user.id;
    schemaAlunoToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_schema_check@thunderafit.test", password: pw })
    ).body.accessToken;
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: schemaAlunoId });

    const tpl = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ name: "Programa Schema Check" });
    const session = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/sessions`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ letter: "A" });

    await supertest(server.server)
      .post(`/api/workouts/${session.body.session.id}/exercises`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ exerciseId: exerciseIds[0], sets: 3, repsRange: "8-12", restSeconds: 60, order: 1 });

    const applied = await supertest(server.server)
      .post(`/api/workout-programs/${tpl.body.program.id}/apply`)
      .set("Authorization", `Bearer ${personalToken}`)
      .send({ alunoId: schemaAlunoId });
    schemaProgramId = applied.body.program.id;
    const appliedWorkoutId = applied.body.program.workouts[0].id;
    const appliedWorkoutExerciseId = applied.body.program.workouts[0].exercises[0].id;

    await supertest(server.server)
      .post(`/api/workouts/${appliedWorkoutId}/exercises/${appliedWorkoutExerciseId}/logs`)
      .set("Authorization", `Bearer ${schemaAlunoToken}`)
      .send({ setNumber: 1, repsDone: 10, weightKg: 20 });
  });

  it("chaves de programa/sessão/exercício/série batem exatamente com o mapeamento campo-a-campo", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs/${schemaProgramId}`)
      .set("Authorization", `Bearer ${schemaAlunoToken}`);
    expect(r.status).toBe(200);

    const program = r.body.program;
    expect(Object.keys(program).sort()).toEqual(
      [
        "id",
        "personalId",
        "origin",
        "name",
        "isTemplate",
        "alunoId",
        "sessionScheme",
        "createdAt",
        "updatedAt",
        "category",
        "bannerImageUrl",
        "description",
        "tags",
        "workouts",
      ].sort()
    );

    const session = program.workouts[0];
    expect(Object.keys(session).sort()).toEqual(
      [
        "id",
        "programId",
        "personalId",
        "alunoId",
        "name",
        "letter",
        "lastCompletedAt",
        "createdAt",
        "updatedAt",
        "suggestedNext",
        "exercises",
      ].sort()
    );

    const we = session.exercises[0];
    expect(Object.keys(we).sort()).toEqual(
      [
        "id",
        "workoutId",
        "exerciseId",
        "sets",
        "repsRange",
        "restSeconds",
        "order",
        "notes",
        "createdAt",
        "updatedAt",
        "exercise",
        "setLogs",
      ].sort()
    );
    expect(Object.keys(we.exercise).sort()).toEqual(
      [
        "id",
        "name",
        "muscleGroup",
        "equipment",
        "mediaUrl",
        "youtubeSupplementUrl",
        "mediaType",
        "description",
        "difficultyLevel",
        "isFeatured",
        "createdAt",
        "updatedAt",
      ].sort()
    );
    expect(we.setLogs).toHaveLength(1);
    expect(Object.keys(we.setLogs[0]).sort()).toEqual(
      ["id", "workoutExerciseId", "setNumber", "repsDone", "weightKg", "loggedAt"].sort()
    );
  });
});

// Perf (Grupo Y, item 102) — cap defensivo aditivo em GET /api/workout-programs
// (page/pageSize opcionais, mesmo padrão de GET /api/admin/users). Personal
// dedicado com contagem EXATA de templates (não o `personalId` compartilhado
// do arquivo, que já acumula programas de todos os outros blocos) — sem
// isso, o teste de "quantos vieram" ficaria refém da ordem de execução dos
// outros describes.
describe("Perf (Grupo Y, item 102) — page/pageSize opcionais em GET /api/workout-programs", () => {
  let pagPersonalId: string;
  let pagPersonalToken: string;
  let seededIds: string[];

  beforeAll(async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_pag_personal@thunderafit.test", password: pw, role: "PERSONAL" });
    pagPersonalId = reg.body.user.id;
    pagPersonalToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_pag_personal@thunderafit.test", password: pw })
    ).body.accessToken;

    // `createdAt` espaçado manualmente (não deixado pro `@default(now())` em
    // sequência) — 5 creates awaited em sequência podem cair no mesmo
    // milissegundo, o que tornaria a ordem "mais recente primeiro" ambígua e
    // o teste de ordem abaixo flaky.
    seededIds = [];
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      const p = await prisma.workoutProgram.create({
        data: {
          personalId: pagPersonalId,
          origin: "PERSONAL",
          name: `Paginação ${i}`,
          isTemplate: true,
          createdAt: new Date(base + i * 1000),
        },
      });
      seededIds.push(p.id);
    }
  });

  afterAll(async () => {
    await prisma.workoutProgram.deleteMany({ where: { personalId: pagPersonalId } });
    await prisma.user.deleteMany({ where: { id: pagPersonalId } });
  });

  it("sem page/pageSize, devolve todos os 5 (comportamento de hoje preservado)", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs?type=template")
      .set("Authorization", `Bearer ${pagPersonalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs).toHaveLength(5);
  });

  it("?pageSize=2 devolve só os 2 mais recentes (orderBy createdAt desc preservado)", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs?type=template&pageSize=2")
      .set("Authorization", `Bearer ${pagPersonalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.map((p: any) => p.id)).toEqual([seededIds[4], seededIds[3]]);
  });

  it("?pageSize=2&page=2 devolve a próxima dupla, não repete a primeira página", async () => {
    const r = await supertest(server.server)
      .get("/api/workout-programs?type=template&pageSize=2&page=2")
      .set("Authorization", `Bearer ${pagPersonalToken}`);
    expect(r.status).toBe(200);
    expect(r.body.programs.map((p: any) => p.id)).toEqual([seededIds[2], seededIds[1]]);
  });
});

// Perf (Grupo Y, item 102 — pedido do fundador na mesma rodada): teto fixo
// de MAX_PERSONAL_TEMPLATES templates por Personal, checado nos dois
// caminhos que criam um template novo (createTemplate E
// saveInstanceAsTemplate — os dois incrementam a mesma contagem).
describe("Perf (Grupo Y, item 102 — pedido do fundador) — teto de 50 templates por Personal", () => {
  let limitPersonalId: string;
  let limitPersonalToken: string;
  let appliedInstanceId: string;

  beforeAll(async () => {
    const reg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_limit_personal@thunderafit.test", password: pw, role: "PERSONAL" });
    limitPersonalId = reg.body.user.id;
    limitPersonalToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_limit_personal@thunderafit.test", password: pw })
    ).body.accessToken;

    // 48 templates + 1 "template fonte" (vira uma instância aplicada abaixo,
    // sem gastar uma chamada real de criação a mais) = 49 no total — deixa
    // exatamente 1 vaga livre até o teto de 50, pra testar a FRONTEIRA exata
    // (49→cria o 50º, 50→rejeita o 51º) em vez de só "sempre rejeita".
    // Seed direto no banco: 49 POSTs reais não testariam nada que os testes
    // de criação já existentes neste arquivo não cobrem.
    await prisma.workoutProgram.createMany({
      data: Array.from({ length: 48 }, (_, i) => ({
        personalId: limitPersonalId,
        origin: "PERSONAL" as const,
        name: `Seed ${i}`,
        isTemplate: true,
      })),
    });
    const source = await prisma.workoutProgram.create({
      data: { personalId: limitPersonalId, origin: "PERSONAL", name: "Template Fonte", isTemplate: true },
    });
    await prisma.workout.create({ data: { programId: source.id, name: "Sessão A", letter: "A" } });

    const alunoReg = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_limit_aluno@thunderafit.test", password: pw, role: "ALUNO" });
    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${limitPersonalToken}`)
      .send({ alunoId: alunoReg.body.user.id });
    const applied = await supertest(server.server)
      .post(`/api/workout-programs/${source.id}/apply`)
      .set("Authorization", `Bearer ${limitPersonalToken}`)
      .send({ alunoId: alunoReg.body.user.id });
    appliedInstanceId = applied.body.program.id;
  });

  afterAll(async () => {
    const progs = await prisma.workoutProgram.findMany({
      where: { personalId: limitPersonalId },
      select: { id: true },
    });
    const progIds = progs.map((p) => p.id);
    const workouts = await prisma.workout.findMany({
      where: { programId: { in: progIds } },
      select: { id: true },
    });
    const wIds = workouts.map((w) => w.id);
    const wes = await prisma.workoutExercise.findMany({ where: { workoutId: { in: wIds } }, select: { id: true } });
    await prisma.setLog.deleteMany({ where: { workoutExerciseId: { in: wes.map((w) => w.id) } } });
    await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: wIds } } });
    await prisma.workout.deleteMany({ where: { programId: { in: progIds } } });
    await prisma.workoutProgram.deleteMany({ where: { personalId: limitPersonalId } });
    await prisma.clientRelation.deleteMany({ where: { personalId: limitPersonalId } });
    await prisma.user.deleteMany({
      where: { email: { in: ["wp_limit_personal@thunderafit.test", "wp_limit_aluno@thunderafit.test"] } },
    });
  });

  it("com 49 templates, cria o 50º normalmente", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${limitPersonalToken}`)
      .send({ name: "Template 50" });
    expect(r.status).toBe(201);
  });

  it("com 50 templates (teto atingido), criar mais um retorna 403", async () => {
    const r = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${limitPersonalToken}`)
      .send({ name: "Template 51" });
    expect(r.status).toBe(403);
    expect(r.body.error).toContain("50");
  });

  it("com o teto atingido, salvar uma instância como template também retorna 403 (mesmo teto nos 2 caminhos)", async () => {
    const r = await supertest(server.server)
      .post(`/api/workout-programs/${appliedInstanceId}/save-as-template`)
      .set("Authorization", `Bearer ${limitPersonalToken}`)
      .send({ name: "Instância Virou Template" });
    expect(r.status).toBe(403);
    expect(r.body.error).toContain("50");
  });
});

describe("Auditoria 2026-07-31, X7 — desvincular revoga a LEITURA do Personal ao programa daquele aluno", () => {
  let exPersonalId: string;
  let exPersonalToken: string;
  let exAlunoId: string;
  let programId: string;

  beforeAll(async () => {
    const regP = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_x7_personal@thunderafit.test", password: pw, role: "PERSONAL" });
    exPersonalId = regP.body.user.id;
    exPersonalToken = (
      await supertest(server.server)
        .post("/api/auth/login")
        .send({ email: "wp_x7_personal@thunderafit.test", password: pw })
    ).body.accessToken;
    const regA = await supertest(server.server)
      .post("/api/auth/register")
      .send({ email: "wp_x7_aluno@thunderafit.test", password: pw, role: "ALUNO" });
    exAlunoId = regA.body.user.id;

    await supertest(server.server)
      .post("/api/relations")
      .set("Authorization", `Bearer ${exPersonalToken}`)
      .send({ alunoId: exAlunoId });

    const template = await supertest(server.server)
      .post("/api/workout-programs")
      .set("Authorization", `Bearer ${exPersonalToken}`)
      .send({ name: "Template X7" });
    await supertest(server.server)
      .post(`/api/workout-programs/${template.body.program.id}/sessions`)
      .set("Authorization", `Bearer ${exPersonalToken}`)
      .send({ name: "Sessão A", letter: "A" });
    const applied = await supertest(server.server)
      .post(`/api/workout-programs/${template.body.program.id}/apply`)
      .set("Authorization", `Bearer ${exPersonalToken}`)
      .send({ alunoId: exAlunoId });
    programId = applied.body.program.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ["wp_x7_personal@thunderafit.test", "wp_x7_aluno@thunderafit.test"] } },
    });
  });

  it("ANTES de desvincular, o Personal lê o programa normalmente", async () => {
    const r = await supertest(server.server)
      .get(`/api/workout-programs/${programId}`)
      .set("Authorization", `Bearer ${exPersonalToken}`);
    expect(r.status).toBe(200);
  });

  it("DEPOIS de desvincular, o mesmo Personal recebe 403 ao tentar reabrir o programa do ex-aluno", async () => {
    const del = await supertest(server.server)
      .delete(`/api/relations/${exAlunoId}`)
      .set("Authorization", `Bearer ${exPersonalToken}`);
    expect(del.status).toBe(204);

    const r = await supertest(server.server)
      .get(`/api/workout-programs/${programId}`)
      .set("Authorization", `Bearer ${exPersonalToken}`);
    expect(r.status).toBe(403);

    // O histórico do ALUNO em si continua intacto — só o ex-Personal perde a leitura.
    const stillExists = await prisma.workoutProgram.findUnique({ where: { id: programId } });
    expect(stillExists).not.toBeNull();
  });
});
