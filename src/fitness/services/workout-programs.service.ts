import { SessionScheme, Locale } from "@prisma/client";
import { workoutProgramsRepository, orderFor, WEEKDAY_ORDER } from "../repository/workout-programs.repository";
import { relationsRepository } from "../repository/relations.repository";
import { exerciseTranslationService } from "./exercise-translation.service";

const VALID_SCHEMES: SessionScheme[] = ["LETTER", "WEEKDAY"];

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export const workoutProgramsService = {
  async createTemplate(personalId: string, name: string, sessionScheme?: SessionScheme) {
    if (!name?.trim()) throw httpError("Nome do programa é obrigatório.", 400);
    const scheme = sessionScheme ?? "LETTER";
    if (!VALID_SCHEMES.includes(scheme)) {
      throw httpError("sessionScheme deve ser LETTER ou WEEKDAY.", 400);
    }
    return workoutProgramsRepository.createProgram(personalId, name.trim(), true, null, scheme);
  },

  async addSession(programId: string, personalId: string, name: string, letter: string) {
    const program = await workoutProgramsRepository.findProgramById(programId);
    if (!program) throw httpError("Programa não encontrado.", 404);
    // Fase 34: programas origin: SELF são geridos só pelo admin (Fase 34.5),
    // nunca por esta rota do Personal — checagem explícita de origin, não só
    // personalId (mesmo raciocínio de defesa explícita do apply() acima).
    if (program.origin !== "PERSONAL" || program.personalId !== personalId) {
      throw httpError("Você não tem permissão para editar este programa.", 403);
    }
    const validKeys = orderFor(program.sessionScheme);
    if (!validKeys.includes(letter)) {
      throw httpError(
        program.sessionScheme === "WEEKDAY"
          ? "Sessão deve ser um dia da semana válido (SEGUNDA a DOMINGO)."
          : "Sessão deve ser uma letra de A a E.",
        400
      );
    }

    const program2 = await workoutProgramsRepository.findProgramWithSessions(programId);
    const sessions = program2?.workouts ?? [];
    if (sessions.length >= validKeys.length) {
      throw httpError(
        `Um programa pode ter no máximo ${validKeys.length} sessões (${program.sessionScheme === "WEEKDAY" ? "Segunda a Domingo" : "A-E"}).`,
        400
      );
    }
    if (sessions.some((s) => s.letter === letter)) {
      throw httpError(`A sessão ${letter} já existe neste programa.`, 409);
    }

    // Sessão de template não tem aluno (alunoId nulo); herda o nome do
    // programa se nenhum for informado.
    return workoutProgramsRepository.addSession(
      programId,
      personalId,
      program.alunoId,
      name?.trim() || `${program.name} — ${letter}`,
      letter
    );
  },

  async apply(sourceProgramId: string, personalId: string, alunoId: string) {
    if (!alunoId) throw httpError("alunoId é obrigatório.", 400);
    const source = await workoutProgramsRepository.findProgramById(sourceProgramId);
    if (!source) throw httpError("Programa não encontrado.", 404);
    // Fase 34: defesa explícita — um programa origin: SELF nunca tem
    // personalId preenchido, então já cairia no 403 abaixo por construção;
    // mas checar origin também deixa a intenção clara e não depende só de
    // personalId nunca coincidir por acidente.
    if (source.origin !== "PERSONAL" || source.personalId !== personalId) {
      throw httpError("Você não tem permissão para aplicar este programa.", 403);
    }

    // Mesmo contrato de vínculo de POST /api/workouts: só aplica a um aluno
    // realmente vinculado a este profissional.
    const relation = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (!relation) {
      throw httpError("Aluno não vinculado a este profissional.", 403);
    }

    // Fase 41: 1 programa aplicado por aluno, POR PERSONAL — escopado por
    // personalId de propósito (um aluno pode ter mais de um Personal
    // vinculado; cada um só é limitado ao PRÓPRIO programa aplicado, nunca
    // ao de outro profissional). Sem substituição automática: o Personal
    // precisa excluir o programa atual primeiro (ação que já existe e já
    // avisa que apaga o histórico de séries) antes de aplicar um novo.
    const existing = await workoutProgramsRepository.findAppliedProgramForAlunoByPersonal(
      personalId,
      alunoId
    );
    if (existing) {
      throw httpError(
        `Este aluno já tem o programa "${existing.name}" aplicado por você. Exclua-o antes de aplicar um novo.`,
        409
      );
    }

    const copy = await workoutProgramsRepository.applyToAluno(sourceProgramId, personalId, alunoId);
    if (!copy) throw httpError("Falha ao aplicar o programa.", 500);
    return copy;
  },

  async listPrograms(personalId: string, type?: "template" | "instance", alunoId?: string) {
    return workoutProgramsRepository.listByPersonal(personalId, type, alunoId);
  },

  /**
   * Fase 31: apaga um programa (template ou instância aplicada) — o Personal
   * não tinha nenhuma forma de desfazer o que criou.
   *
   * Bugs potenciais considerados antes de escrever esta função:
   * - checar posse DEPOIS de já ter apagado algo (a ordem tem que ser: busca
   *   → 404 se não existe → 403 se não é dono → só então apaga).
   * - confiar em `personalId` vindo do corpo/query em vez do `sub` do JWT
   *   (quem chama este método já resolve isso — o controller nunca deve
   *   aceitar personalId de input, só o do usuário autenticado).
   * - não distinguir template de instância aqui: a checagem de posse é a
   *   MESMA para os dois (o dono é sempre `program.personalId`); a UI decide
   *   o texto de aviso, o backend só verifica dono + existência.
   */
  async deleteProgram(programId: string, personalId: string) {
    const program = await workoutProgramsRepository.findProgramById(programId);
    if (!program) throw httpError("Programa não encontrado.", 404);
    if (program.origin !== "PERSONAL" || program.personalId !== personalId) {
      throw httpError("Você não tem permissão para excluir este programa.", 403);
    }
    await workoutProgramsRepository.deleteProgram(programId);
  },

  async listForAluno(alunoId: string) {
    return workoutProgramsRepository.listByAluno(alunoId);
  },

  // --- Fase 34.5: "Meu treino pessoal" ---

  async listSelfTemplates() {
    return workoutProgramsRepository.listSelfTemplates();
  },

  async applySelfTemplate(sourceProgramId: string, alunoId: string) {
    const copy = await workoutProgramsRepository.applySelfTemplateToAluno(sourceProgramId, alunoId);
    if (!copy) throw httpError("Template não encontrado.", 404);
    return copy;
  },

  /**
   * Visão de um programa com o cálculo de `suggestedNext` por sessão.
   *
   * Regra de sugestão pra esquema LETTER (Fase 16, inalterada): a sessão
   * sugerida é a de MENOR letra que NUNCA foi concluída (lastCompletedAt
   * nulo). Se todas já foram concluídas ao menos uma vez, é a de conclusão
   * mais ANTIGA (menor lastCompletedAt) — round-robin sem repetir enquanto
   * houver sessão nunca feita.
   *
   * Regra pra esquema WEEKDAY (Fase 39 — corrigido um bug real: antes usava
   * a MESMA lógica de round-robin do LETTER, ignorando completamente o dia
   * da semana atual, o que não faz sentido pra um programa organizado por
   * dia): a sugestão é SEMPRE a sessão do dia da semana de HOJE,
   * deterministicamente — não depende de histórico de conclusão. Se o
   * programa não tem sessão cadastrada pro dia de hoje (ex: só treina
   * Segunda a Sexta e hoje é Sábado), não há sugestão (null) — é só
   * sugestão, nunca trava o aluno, que pode abrir qualquer sessão.
   */
  async getProgram(programId: string, userId: string, role: string, locale: Locale) {
    const program = await workoutProgramsRepository.findProgramWithSessions(programId);
    if (!program) throw httpError("Programa não encontrado.", 404);

    const isOwnerPersonal = program.personalId === userId;
    const isOwnerAluno = program.alunoId === userId;
    if (role !== "ADMIN" && !isOwnerPersonal && !isOwnerAluno) {
      throw httpError("Você não tem permissão para acessar este programa.", 403);
    }

    const sessions = sortByScheme(program.workouts, program.sessionScheme);
    const suggestedId = computeSuggestedSessionId(sessions, program.sessionScheme);

    // i18n: cada sessão tem seus próprios exercícios aninhados (exercise
    // embutido via include), mesmo utilitário usado no catálogo avulso e na
    // execução de treino. Traduzido em UMA chamada só pra todos os
    // exercícios de todas as sessões (em vez de 1 chamada — e 1 query em
    // ExerciseTranslation — por sessão), depois redistribuído de volta pra
    // cada sessão na mesma posição/ordem original.
    const allExercises = sessions.flatMap((s) => s.exercises);
    const translatedExercises = await exerciseTranslationService.translateNested(allExercises, locale);

    let cursor = 0;
    const translatedSessions = sessions.map((s) => {
      const exercises = translatedExercises.slice(cursor, cursor + s.exercises.length);
      cursor += s.exercises.length;
      return {
        ...s,
        suggestedNext: s.id === suggestedId,
        exercises,
      };
    });

    return { ...program, workouts: translatedSessions };
  },
};

/**
 * Ordena sessões pela sequência do esquema do programa — NUNCA por
 * localeCompare puro (Fase 26: a ordem alfabética de WEEKDAY não bate com a
 * ordem do calendário, ex: "QUARTA" < "SEGUNDA").
 */
export function sortByScheme<T extends { letter: string }>(
  sessions: T[],
  scheme: SessionScheme = "LETTER"
): T[] {
  const order = orderFor(scheme);
  return [...sessions].sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter));
}

// Dia da semana de `now` como chave de WEEKDAY_ORDER (SEGUNDA..DOMINGO).
// Usa o dia calendário em UTC — mesmo critério já usado em todo o resto do
// código pra "dia" (ex: progress.service.ts::dayKey), pra não introduzir um
// segundo critério de fuso horário só aqui.
function todayWeekdayKey(now: Date): string {
  const utcDay = now.getUTCDay(); // 0=Domingo .. 6=Sábado
  return WEEKDAY_ORDER[(utcDay + 6) % 7];
}

/** Ver regra em getProgram. Retorna o id da sessão sugerida, ou null. */
export function computeSuggestedSessionId(
  sessions: Array<{ id: string; letter: string; lastCompletedAt: Date | null }>,
  scheme: SessionScheme = "LETTER",
  now: Date = new Date()
): string | null {
  if (sessions.length === 0) return null;

  if (scheme === "WEEKDAY") {
    const todayKey = todayWeekdayKey(now);
    const todaySession = sessions.find((s) => s.letter === todayKey);
    return todaySession ? todaySession.id : null;
  }

  const ordered = sortByScheme(sessions, scheme);

  const nuncaFeita = ordered.find((s) => s.lastCompletedAt === null);
  if (nuncaFeita) return nuncaFeita.id;

  // Todas já feitas: a de conclusão mais antiga.
  let oldest = ordered[0];
  for (const s of ordered) {
    if (s.lastCompletedAt! < oldest.lastCompletedAt!) oldest = s;
  }
  return oldest.id;
}
