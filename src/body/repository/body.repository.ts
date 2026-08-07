import prisma from "../../lib/prisma";
import { Role } from "@prisma/client";

/**
 * Fase 121: histórico de medições corporais. Repository é Prisma-only (regra do
 * projeto) — toda validação e autorização vive no service.
 */
export const bodyRepository = {
  /** Mais recentes primeiro; o índice `(alunoId, measuredAt)` cobre esta ordem. */
  async listForAluno(alunoId: string, take: number) {
    return prisma.bodyMeasurement.findMany({
      where: { alunoId },
      orderBy: { measuredAt: "desc" },
      take,
    });
  },

  async findById(id: string) {
    return prisma.bodyMeasurement.findUnique({ where: { id } });
  },

  async create(data: {
    alunoId: string;
    measuredAt: Date;
    weightKg: number;
    waistCm: number | null;
    bodyFatPercent: number | null;
    recordedByRole: Role;
    recordedByUserId: string;
  }) {
    return prisma.bodyMeasurement.create({ data });
  },

  async delete(id: string) {
    return prisma.bodyMeasurement.delete({ where: { id } });
  },

  /** Vínculo profissional↔aluno, pro gate de leitura/escrita do Personal. */
  async findRelation(professionalId: string, alunoId: string) {
    return prisma.clientRelation.findFirst({ where: { personalId: professionalId, alunoId } });
  },
};
