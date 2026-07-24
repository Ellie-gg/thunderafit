import prisma from "../../lib/prisma";
import { SessionScheme } from "@prisma/client";

// Teto de segurança pro histórico de séries trazido por exercício prescrito —
// sem isso, `setLogs` cresce sem limite pra sempre pra um usuário de longo
// prazo. O frontend só consome (a) as séries desta sessão (poucas, sempre
// depois do boundary) e (b) a última série de um ciclo anterior por número de
// série (`splitSetLogsBySessionBoundary` + `lastTimeSameSet` em
// exercise-execution-card.tsx) — 100 séries cobrem confortavelmente muitos
// meses de histórico (bem mais que os poucos ciclos anteriores realmente
// usados), então o corte não muda nenhum comportamento visível.
const SET_LOG_HISTORY_LIMIT = 100;

// Fase 26: ordem "de calendário/sequência" de cada esquema — usada pra validar
// chaves aceitas, calcular o limite de sessões e ordenar sessões
// corretamente (a ordem alfabética de LETTER coincide por acaso; a de WEEKDAY
// NÃO coincide, ex: "QUARTA" < "SEGUNDA" alfabeticamente).
export const LETTER_ORDER = ["A", "B", "C", "D", "E"];
export const WEEKDAY_ORDER = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
];

export function orderFor(scheme: SessionScheme): string[] {
  return scheme === "WEEKDAY" ? WEEKDAY_ORDER : LETTER_ORDER;
}

export const workoutProgramsRepository = {
  async createProgram(
    personalId: string,
    name: string,
    isTemplate: boolean,
    alunoId: string | null,
    sessionScheme: SessionScheme = "LETTER"
  ) {
    // Sempre origin: PERSONAL — esta função é chamada só pelo fluxo do
    // Personal (createTemplate). Templates origin: SELF são criados pelo
    // admin, por uma função dedicada (Fase 34.5), nunca por esta.
    return prisma.workoutProgram.create({
      data: { personalId, origin: "PERSONAL", name, isTemplate, alunoId, sessionScheme },
    });
  },

  async findProgramById(id: string) {
    return prisma.workoutProgram.findUnique({ where: { id } });
  },

  /** Programa com suas sessões (+ exercícios). setLogs incluídos para a visão do aluno. */
  async findProgramWithSessions(id: string) {
    const program = await prisma.workoutProgram.findUnique({
      where: { id },
      include: {
        workouts: {
          orderBy: { letter: "asc" },
          include: {
            exercises: {
              orderBy: { order: "asc" },
              include: {
                exercise: true,
                // desc + take = "os N mais recentes"; revertido pra asc logo
                // abaixo, já que o frontend depende dessa ordem (ver comentário
                // de SET_LOG_HISTORY_LIMIT acima).
                setLogs: { orderBy: { loggedAt: "desc" }, take: SET_LOG_HISTORY_LIMIT },
              },
            },
          },
        },
      },
    });
    if (!program) return program;
    for (const workout of program.workouts) {
      for (const workoutExercise of workout.exercises) {
        workoutExercise.setLogs.reverse();
      }
    }
    return program;
  },

  async countSessions(programId: string) {
    return prisma.workout.count({ where: { programId } });
  },

  async addSession(
    programId: string,
    personalId: string,
    alunoId: string | null,
    name: string,
    letter: string
  ) {
    return prisma.workout.create({
      data: { programId, personalId, alunoId, name, letter },
    });
  },

  /**
   * Lista programas do Personal. `type`:
   *  - "template": só templates (isTemplate=true)
   *  - "instance": só instâncias aplicadas a alunos (isTemplate=false)
   *  - undefined: todos
   * `alunoId` (Fase 29, opcional): restringe às instâncias aplicadas a UM
   * aluno específico — sempre ANDado com `personalId` (nunca substitui), já
   * que `personalId` vem do JWT autenticado, não de input do cliente; um
   * template (alunoId=null) nunca bate com este filtro, então passar
   * `alunoId` já exclui templates implicitamente, sem precisar combinar com
   * `type: "instance"`.
   *
   * Bugs potenciais considerados antes de escrever esta função:
   * - trocar `where` inteiro por `{ alunoId }` em vez de acumular no mesmo
   *   objeto já escopado por `personalId` — deixaria um Personal ver
   *   programas de OUTRO Personal aplicados ao mesmo aluno (IDOR real).
   * - esquecer que `alunoId` e `type` precisam compor (um Personal pode
   *   querer `?type=instance&alunoId=X` juntos) — ambos são adicionados ao
   *   mesmo objeto `where`, não são exclusivos entre si.
   */
  async listByPersonal(personalId: string, type?: "template" | "instance", alunoId?: string) {
    // Fase 34: origin: "PERSONAL" explícito — esta é A listagem do fluxo do
    // Personal; nunca deve devolver um programa origin: SELF, mesmo que
    // algum dia personalId pudesse coincidir por acidente. Defesa explícita,
    // não implícita (não basta confiar em personalId nunca ser null aqui).
    const where: {
      personalId: string;
      origin: "PERSONAL";
      isTemplate?: boolean;
      alunoId?: string;
    } = { personalId, origin: "PERSONAL" };
    if (type === "template") where.isTemplate = true;
    if (type === "instance") where.isTemplate = false;
    if (alunoId) where.alunoId = alunoId;
    return prisma.workoutProgram.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true } } },
    });
  },

  /**
   * Fase 41: checagem de "1 programa aplicado por aluno, POR PERSONAL" —
   * escopado por `personalId` de propósito. Um aluno pode ter mais de um
   * Personal vinculado (ClientRelation é N:N de verdade, sem unique só em
   * `alunoId`); cada Personal só pode ter UM programa aplicado a ele, mas
   * isso não impede um Personal DIFERENTE de aplicar o dele ao mesmo aluno.
   */
  async findAppliedProgramForAlunoByPersonal(personalId: string, alunoId: string) {
    return prisma.workoutProgram.findFirst({
      where: { personalId, origin: "PERSONAL", alunoId, isTemplate: false },
    });
  },

  async listByAluno(alunoId: string) {
    return prisma.workoutProgram.findMany({
      where: { alunoId, isTemplate: false },
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true, lastCompletedAt: true } } },
    });
  },

  /**
   * Aplica (COPIA) um programa a um aluno: cria um novo WorkoutProgram
   * (isTemplate=false, alunoId preenchido) e replica sessões + exercícios como
   * cópias independentes. NÃO copia setLogs (execução pertence ao aluno, um
   * template não tem). Cópia, não referência — editar o template depois não
   * afeta esta instância (decisão documentada, Fase 16). Tudo numa transação.
   */
  async applyToAluno(sourceProgramId: string, personalId: string, alunoId: string) {
    const source = await prisma.workoutProgram.findUnique({
      where: { id: sourceProgramId },
      include: { workouts: { include: { exercises: true } } },
    });
    if (!source) return null;

    return prisma.$transaction(async (tx) => {
      const copy = await tx.workoutProgram.create({
        data: {
          personalId,
          origin: "PERSONAL",
          alunoId,
          name: source.name,
          isTemplate: false,
          sessionScheme: source.sessionScheme,
        },
      });
      for (const w of source.workouts) {
        const newWorkout = await tx.workout.create({
          data: {
            programId: copy.id,
            personalId,
            alunoId,
            name: w.name,
            letter: w.letter,
          },
        });
        if (w.exercises.length > 0) {
          await tx.workoutExercise.createMany({
            data: w.exercises.map((e) => ({
              workoutId: newWorkout.id,
              exerciseId: e.exerciseId,
              sets: e.sets,
              repsRange: e.repsRange,
              restSeconds: e.restSeconds,
              order: e.order,
              notes: e.notes,
            })),
          });
        }
      }
      return tx.workoutProgram.findUnique({
        where: { id: copy.id },
        include: { workouts: { include: { exercises: true } } },
      });
    });
  },

  /**
   * Fase 31: apaga um programa (template OU instância aplicada) e tudo que
   * depende dele — sessões, exercícios prescritos e séries registradas.
   * Nenhuma FK do schema tem `onDelete: Cascade`, então a ordem importa:
   * setLog → workoutExercise → workout → workoutProgram (de baixo pra cima,
   * senão o Postgres rejeita por violação de chave estrangeira).
   *
   * Bugs potenciais considerados antes de escrever esta função:
   * - apagar fora de ordem (ex: workout antes de workoutExercise) — violaria
   *   a FK e a transação inteira falharia no meio.
   * - fazer cada delete como uma chamada solta (sem transação) deixaria o
   *   estado pela metade se uma etapa falhasse (ex: setLogs apagados mas
   *   workoutExercises não) — tudo dentro de um único `$transaction`.
   * - a checagem de posse (o programa é mesmo do personalId autenticado) é
   *   responsabilidade do SERVICE, não daqui — esta função assume que quem
   *   chamou já validou (mesma divisão de responsabilidade de `applyToAluno`
   *   acima, que também não revalida posse).
   */
  // --- Fase 34.5: "Meu treino pessoal" (templates origin: SELF) ---

  /** Catálogo de templates SELF disponíveis pro aluno escolher e aplicar. */
  async listSelfTemplates() {
    return prisma.workoutProgram.findMany({
      where: { origin: "SELF", isTemplate: true },
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true } } },
    });
  },

  /**
   * Aplica (COPIA) um template SELF pro próprio aluno — mesmo padrão de
   * `applyToAluno` (cópia independente, não referência), mas sem Personal
   * nenhum envolvido: a cópia também é origin: SELF, personalId null.
   */
  async applySelfTemplateToAluno(sourceProgramId: string, alunoId: string) {
    const source = await prisma.workoutProgram.findFirst({
      where: { id: sourceProgramId, origin: "SELF", isTemplate: true },
      include: { workouts: { include: { exercises: true } } },
    });
    if (!source) return null;

    return prisma.$transaction(async (tx) => {
      const copy = await tx.workoutProgram.create({
        data: {
          personalId: null,
          origin: "SELF",
          alunoId,
          name: source.name,
          isTemplate: false,
          sessionScheme: source.sessionScheme,
        },
      });
      for (const w of source.workouts) {
        const newWorkout = await tx.workout.create({
          data: {
            programId: copy.id,
            personalId: null,
            alunoId,
            name: w.name,
            letter: w.letter,
          },
        });
        if (w.exercises.length > 0) {
          await tx.workoutExercise.createMany({
            data: w.exercises.map((e) => ({
              workoutId: newWorkout.id,
              exerciseId: e.exerciseId,
              sets: e.sets,
              repsRange: e.repsRange,
              restSeconds: e.restSeconds,
              order: e.order,
              notes: e.notes,
            })),
          });
        }
      }
      return tx.workoutProgram.findUnique({
        where: { id: copy.id },
        include: { workouts: { include: { exercises: true } } },
      });
    });
  },

  async deleteProgram(programId: string) {
    const workouts = await prisma.workout.findMany({
      where: { programId },
      select: { id: true },
    });
    const workoutIds = workouts.map((w) => w.id);

    await prisma.$transaction(async (tx) => {
      await tx.setLog.deleteMany({ where: { workoutExercise: { workoutId: { in: workoutIds } } } });
      await tx.workoutExercise.deleteMany({ where: { workoutId: { in: workoutIds } } });
      await tx.workout.deleteMany({ where: { programId } });
      await tx.workoutProgram.delete({ where: { id: programId } });
    });
  },
};
