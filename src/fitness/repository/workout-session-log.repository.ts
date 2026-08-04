import prisma from "../../lib/prisma";

// Fase 112 (plano de captura de dados pro dashboard histórico): 1 linha por
// CONCLUSÃO real de sessão — ver comentário do model em schema.prisma pro
// racional completo (substitui a heurística de janela de 6h que o resumo
// pós-treino usava antes).
export const workoutSessionLogRepository = {
  async create(data: {
    workoutId: string;
    alunoId: string;
    startedAt: Date | null;
    completedAt: Date;
    durationSeconds: number | null;
    volumeKg: number;
    setsCompleted: number;
  }) {
    return prisma.workoutSessionLog.create({ data });
  },

  async findById(id: string) {
    return prisma.workoutSessionLog.findUnique({ where: { id } });
  },

  async setRpe(id: string, rpe: number) {
    return prisma.workoutSessionLog.update({ where: { id }, data: { rpe } });
  },

  // Histórico recente pro gráfico de tendência (C1) — select explícito, só
  // os campos que o gráfico/distribuição realmente plotam (mesmo cuidado de
  // progress.repository.ts#findSetLogsSince).
  async findRecentForAluno(alunoId: string, limit: number) {
    return prisma.workoutSessionLog.findMany({
      where: { alunoId },
      select: {
        id: true,
        completedAt: true,
        durationSeconds: true,
        volumeKg: true,
        rpe: true,
      },
      orderBy: { completedAt: "desc" },
      take: limit,
    });
  },
};
