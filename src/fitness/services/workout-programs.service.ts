import { workoutProgramsRepository } from "../repository/workout-programs.repository";
import { relationsRepository } from "../repository/relations.repository";

const VALID_LETTERS = ["A", "B", "C", "D", "E"];

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export const workoutProgramsService = {
  async createTemplate(personalId: string, name: string) {
    if (!name?.trim()) throw httpError("Nome do programa é obrigatório.", 400);
    return workoutProgramsRepository.createProgram(personalId, name.trim(), true, null);
  },

  async addSession(programId: string, personalId: string, name: string, letter: string) {
    const program = await workoutProgramsRepository.findProgramById(programId);
    if (!program) throw httpError("Programa não encontrado.", 404);
    if (program.personalId !== personalId) {
      throw httpError("Você não tem permissão para editar este programa.", 403);
    }
    if (!VALID_LETTERS.includes(letter)) {
      throw httpError("Sessão deve ser uma letra de A a E.", 400);
    }

    const program2 = await workoutProgramsRepository.findProgramWithSessions(programId);
    const sessions = program2?.workouts ?? [];
    if (sessions.length >= workoutProgramsRepository.MAX_SESSIONS) {
      throw httpError("Um programa pode ter no máximo 5 sessões (A-E).", 400);
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
    if (source.personalId !== personalId) {
      throw httpError("Você não tem permissão para aplicar este programa.", 403);
    }

    // Mesmo contrato de vínculo de POST /api/workouts: só aplica a um aluno
    // realmente vinculado a este profissional.
    const relation = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (!relation) {
      throw httpError("Aluno não vinculado a este profissional.", 403);
    }

    const copy = await workoutProgramsRepository.applyToAluno(sourceProgramId, personalId, alunoId);
    if (!copy) throw httpError("Falha ao aplicar o programa.", 500);
    return copy;
  },

  async listPrograms(personalId: string, type?: "template" | "instance") {
    return workoutProgramsRepository.listByPersonal(personalId, type);
  },

  async listForAluno(alunoId: string) {
    return workoutProgramsRepository.listByAluno(alunoId);
  },

  /**
   * Visão de um programa com o cálculo de `suggestedNext` por sessão.
   *
   * Regra de sugestão (documentada, Fase 16): a sessão sugerida é a de MENOR
   * letra que NUNCA foi concluída (lastCompletedAt nulo). Se todas já foram
   * concluídas ao menos uma vez, é a de conclusão mais ANTIGA (menor
   * lastCompletedAt). Exatamente uma sessão recebe suggestedNext=true (ou
   * nenhuma, se o programa não tem sessões). É só sugestão — não trava o aluno,
   * que pode abrir qualquer sessão.
   */
  async getProgram(programId: string, userId: string, role: string) {
    const program = await workoutProgramsRepository.findProgramWithSessions(programId);
    if (!program) throw httpError("Programa não encontrado.", 404);

    const isOwnerPersonal = program.personalId === userId;
    const isOwnerAluno = program.alunoId === userId;
    if (role !== "ADMIN" && !isOwnerPersonal && !isOwnerAluno) {
      throw httpError("Você não tem permissão para acessar este programa.", 403);
    }

    const sessions = [...program.workouts].sort((a, b) => a.letter.localeCompare(b.letter));
    const suggestedId = computeSuggestedSessionId(sessions);

    return {
      ...program,
      workouts: sessions.map((s) => ({ ...s, suggestedNext: s.id === suggestedId })),
    };
  },
};

/** Ver regra em getProgram. Retorna o id da sessão sugerida, ou null. */
export function computeSuggestedSessionId(
  sessions: Array<{ id: string; letter: string; lastCompletedAt: Date | null }>
): string | null {
  if (sessions.length === 0) return null;
  const ordered = [...sessions].sort((a, b) => a.letter.localeCompare(b.letter));

  const nuncaFeita = ordered.find((s) => s.lastCompletedAt === null);
  if (nuncaFeita) return nuncaFeita.id;

  // Todas já feitas: a de conclusão mais antiga.
  let oldest = ordered[0];
  for (const s of ordered) {
    if (s.lastCompletedAt! < oldest.lastCompletedAt!) oldest = s;
  }
  return oldest.id;
}
