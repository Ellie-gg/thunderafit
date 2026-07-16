import prisma from "../../lib/prisma";

export interface AnamnesisInput {
  fullName?: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  goals?: string;
  healthConditions?: string;
  medications?: string;
  activityLevel?: string;
  pastExperience?: string;
  trainingPreferences?: string;
  injuries?: string;
}

function toData(input: AnamnesisInput) {
  return {
    ...input,
    birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
  };
}

export const anamnesisRepository = {
  async findByAluno(alunoId: string) {
    return prisma.anamnesis.findUnique({ where: { alunoId } });
  },

  async create(alunoId: string, input: AnamnesisInput) {
    return prisma.anamnesis.create({ data: { alunoId, ...toData(input) } });
  },

  async update(alunoId: string, input: AnamnesisInput) {
    return prisma.anamnesis.update({ where: { alunoId }, data: toData(input) });
  },

  /**
   * Consulta ClientRelation direto via Prisma (mesmo padrão do módulo
   * support desta fase) — evita tocar em `/src/fitness`, fora do escopo de
   * arquivos permitido aqui.
   */
  async findRelation(personalId: string, alunoId: string) {
    return prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
  },
};
