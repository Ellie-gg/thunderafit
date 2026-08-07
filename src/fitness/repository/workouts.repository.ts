import prisma from "../../lib/prisma";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";

// Mesmo teto e mesma razão de workout-programs.repository.ts::SET_LOG_HISTORY_LIMIT
// — sem isso, `setLogs` cresce sem limite pra sempre pra um usuário de longo
// prazo, e aqui é o MESMO padrão de include (exercise + setLogs) usado pela
// tela de execução de treino.
const SET_LOG_HISTORY_LIMIT = 100;

export const workoutsRepository = {
  // Criar um treino "avulso" (fluxo legado da Fase 3, ainda usado pela UI e
  // pelos testes) cria, de forma transparente, um WorkoutProgram de 1 sessão
  // para aquele aluno — assim todo Workout sempre pertence a um programa
  // (invariante da Fase 16) sem quebrar o contrato de POST /api/workouts.
  async create(personalId: string, alunoId: string, name: string, letter: string) {
    const program = await prisma.workoutProgram.create({
      data: { personalId, alunoId, name, isTemplate: false },
    });
    return prisma.workout.create({
      data: { personalId, alunoId, name, letter, programId: program.id },
    });
  },

  async findById(id: string) {
    return prisma.workout.findUnique({ where: { id } });
  },

  async updateName(id: string, name: string) {
    return prisma.workout.update({ where: { id }, data: { name } });
  },

  async markCompleted(id: string, when: Date) {
    return prisma.workout.update({
      where: { id },
      data: { lastCompletedAt: when },
    });
  },

  async findAllByAluno(
    alunoId: string,
    pagination: { skip: number; take: number } = { skip: 0, take: DEFAULT_PAGE_SIZE }
  ) {
    return prisma.workout.findMany({
      where: { alunoId },
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    });
  },

  async findAllByPersonal(
    personalId: string,
    pagination: { skip: number; take: number } = { skip: 0, take: DEFAULT_PAGE_SIZE }
  ) {
    return prisma.workout.findMany({
      where: { personalId },
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    });
  },

  async findByIdWithExercises(id: string) {
    const workout = await prisma.workout.findUnique({
      where: { id },
      include: {
        // Fase 34.5: origin do programa — o frontend usa isso pra decidir se
        // mostra o CTA de upsell ("convide um Personal") ao final de um
        // treino origin: SELF, sem precisar de uma chamada à parte.
        // Fase 65: sessionScheme também, pro preview "ver como o aluno vê"
        // do Personal rotular a sessão certo (letra vs dia da semana).
        program: { select: { origin: true, sessionScheme: true } },
        exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: true,
            // desc + take = "os N mais recentes"; revertido pra asc logo
            // abaixo (o frontend depende dessa ordem — ver SET_LOG_HISTORY_LIMIT).
            setLogs: { orderBy: { loggedAt: "desc" }, take: SET_LOG_HISTORY_LIMIT },
          },
        },
      },
    });
    if (!workout) return workout;
    for (const workoutExercise of workout.exercises) {
      workoutExercise.setLogs.reverse();
    }
    return workout;
  },

  async addExercise(
    workoutId: string,
    exerciseId: string,
    sets: number,
    repsRange: string,
    restSeconds: number,
    order: number,
    notes: string | null = null
  ) {
    return prisma.workoutExercise.create({
      data: { workoutId, exerciseId, sets, repsRange, restSeconds, order, notes },
    });
  },

  // Fase 28: reordenar exercícios prescritos (setas ↑/↓).
  async findExercisesOrdered(workoutId: string) {
    return prisma.workoutExercise.findMany({
      where: { workoutId },
      orderBy: { order: "asc" },
    });
  },

  /**
   * Lê a lista ordenada e troca a `order` com o vizinho dentro de UMA única
   * transação — não é só as duas UPDATEs juntas, é a LEITURA também dentro da
   * transação, pra fechar a janela entre "ler a ordem atual" e "escrever a
   * troca" (2 cliques quase simultâneos, num exercício ou em vizinhos,
   * baseados numa leitura já desatualizada, poderiam produzir uma ordem
   * inconsistente sem essa garantia).
   */
  async moveExercise(
    workoutId: string,
    workoutExerciseId: string,
    direction: "up" | "down"
  ): Promise<"not_found" | "first" | "last" | "moved"> {
    return prisma.$transaction(async (tx) => {
      const exercises = await tx.workoutExercise.findMany({
        where: { workoutId },
        orderBy: { order: "asc" },
      });
      const index = exercises.findIndex((e) => e.id === workoutExerciseId);
      if (index === -1) return "not_found";

      const neighborIndex = direction === "up" ? index - 1 : index + 1;
      if (neighborIndex < 0) return "first";
      if (neighborIndex >= exercises.length) return "last";

      const current = exercises[index];
      const neighbor = exercises[neighborIndex];
      await tx.workoutExercise.update({ where: { id: current.id }, data: { order: neighbor.order } });
      await tx.workoutExercise.update({ where: { id: neighbor.id }, data: { order: current.order } });
      return "moved";
    });
  },

  /**
   * Fase 65: remove um exercício prescrito — antes só dava pra adicionar ou
   * reordenar, nunca excluir. `SetLog` não tem `onDelete: Cascade` (mesmo
   * motivo documentado em `deleteProgram` do domínio de programas), então
   * apaga as séries registradas daquele exercício antes de apagar a
   * prescrição em si, dentro da mesma transação.
   */
  async deleteExercise(workoutId: string, workoutExerciseId: string): Promise<"not_found" | "deleted"> {
    return prisma.$transaction(async (tx) => {
      const exercise = await tx.workoutExercise.findFirst({
        where: { id: workoutExerciseId, workoutId },
      });
      if (!exercise) return "not_found";

      await tx.setLog.deleteMany({ where: { workoutExerciseId } });
      await tx.workoutExercise.delete({ where: { id: workoutExerciseId } });
      return "deleted";
    });
  },

  /**
   * Fase 120: exclui a SESSÃO inteira (o "treino do dia" / dia da semana) de um
   * programa — antes só existia excluir um EXERCÍCIO da sessão, ou o programa
   * INTEIRO; não havia meio-termo, então tirar uma sessão errada obrigava a
   * apagar e remontar o programa todo.
   *
   * Mesma ordem de cascade de `workout-programs.repository.ts#deleteProgram`:
   * `SetLog` → `WorkoutExercise` → `Workout`. `WorkoutTranslation` e
   * `WorkoutSessionLog` NÃO aparecem aqui de propósito — os dois têm
   * `onDelete: Cascade` no schema, então o banco resolve.
   *
   * Numa transação porque apagar as séries e deixar a sessão de pé (ou o
   * inverso) é um estado pior do que não ter apagado nada.
   */
  async deleteWorkout(workoutId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.setLog.deleteMany({ where: { workoutExercise: { workoutId } } });
      await tx.workoutExercise.deleteMany({ where: { workoutId } });
      await tx.workout.delete({ where: { id: workoutId } });
    });
  },
};
