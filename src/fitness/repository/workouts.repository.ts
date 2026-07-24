import prisma from "../../lib/prisma";

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

  async markCompleted(id: string, when: Date) {
    return prisma.workout.update({
      where: { id },
      data: { lastCompletedAt: when },
    });
  },

  async findAllByAluno(alunoId: string) {
    return prisma.workout.findMany({ where: { alunoId }, orderBy: { createdAt: "asc" } });
  },

  async findAllByPersonal(personalId: string) {
    return prisma.workout.findMany({ where: { personalId }, orderBy: { createdAt: "asc" } });
  },

  async findByIdWithExercises(id: string) {
    return prisma.workout.findUnique({
      where: { id },
      include: {
        // Fase 34.5: só o origin do programa — o frontend usa isso pra
        // decidir se mostra o CTA de upsell ("convide um Personal") ao final
        // de um treino origin: SELF, sem precisar de uma chamada à parte.
        program: { select: { origin: true } },
        exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: true,
            setLogs: { orderBy: { loggedAt: "asc" } },
          },
        },
      },
    });
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
};
