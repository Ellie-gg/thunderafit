import prisma from "../../lib/prisma";

export const exercisesRepository = {
  async findAll(muscleGroup?: string) {
    return prisma.exercise.findMany({
      where: muscleGroup ? { muscleGroup } : undefined,
      // Fase 34: destaque primeiro (curadoria dos ~5 exercícios mais feitos
      // de cada grupo), depois alfabético — centralizado aqui pra qualquer
      // consumidor da lista (ex: seletor de exercício do Personal) já
      // receber a ordem certa sem precisar reordenar no cliente.
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });
  },

  async findById(id: string) {
    return prisma.exercise.findUnique({ where: { id } });
  },
};
