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
      // `select` explícito: exclui só `createdAt`/`updatedAt`, que nenhum
      // consumidor (seletor de exercício do Personal, Montagem Inteligente,
      // exercise-translation.service) lê. `description` fica: mesmo não
      // sendo usada pelo seletor visual, o teste de i18n do catálogo
      // (`exercise-translation.test.ts`) confere `description` traduzida
      // NESTE MESMO endpoint (GET /api/exercises) — removê-la mudaria o
      // contrato HTTP existente, o que está fora do escopo desta otimização.
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        equipment: true,
        mediaUrl: true,
        mediaType: true,
        description: true,
        difficultyLevel: true,
        isFeatured: true,
      },
    });
  },

  async findById(id: string) {
    return prisma.exercise.findUnique({ where: { id } });
  },
};
