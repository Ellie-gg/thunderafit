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
};
