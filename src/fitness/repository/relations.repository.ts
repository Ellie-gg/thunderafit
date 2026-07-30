import prisma from "../../lib/prisma";

export const relationsRepository = {
  async findByPersonalAndAluno(personalId: string, alunoId: string) {
    return prisma.clientRelation.findUnique({
      where: {
        // Prisma auto-generate unique name based on field names
        personalId_alunoId: { personalId, alunoId },
      },
    });
  },

  async countByPersonal(personalId: string) {
    return prisma.clientRelation.count({ where: { personalId } });
  },

  async create(personalId: string, alunoId: string, professionalType: "PERSONAL" | "NUTRICIONISTA" = "PERSONAL") {
    return prisma.clientRelation.create({
      data: { personalId, alunoId, professionalType },
    });
  },

  async findAllByPersonal(personalId: string) {
    return prisma.clientRelation.findMany({ where: { personalId } });
  },

  // Fase 103: desvincular preserva o WorkoutProgram/histórico do aluno de
  // propósito — só remove o ClientRelation em si (decisão do fundador:
  // remover um aluno pra regularizar o plano nunca deveria destruir dado
  // real). Se o Personal vincular esse aluno de novo depois, o histórico
  // antigo continua lá (`WorkoutProgram.alunoId`/`personalId` não têm FK
  // cascade em ClientRelation, então nada é apagado em cascata por esta
  // operação).
  async delete(personalId: string, alunoId: string) {
    return prisma.clientRelation.delete({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
  },

  async updatePaymentReminder(
    personalId: string,
    alunoId: string,
    dueDate: Date | null,
    recurring: boolean
  ) {
    return prisma.clientRelation.update({
      where: { personalId_alunoId: { personalId, alunoId } },
      data: { paymentReminderDueDate: dueDate, paymentReminderRecurring: recurring },
    });
  },

  async findDueRemindersForAluno(alunoId: string, now: Date) {
    return prisma.clientRelation.findMany({
      where: { alunoId, professionalType: "PERSONAL", paymentReminderDueDate: { lte: now } },
    });
  },

  async advanceReminder(id: string, nextDueDate: Date | null) {
    return prisma.clientRelation.update({
      where: { id },
      data: { paymentReminderDueDate: nextDueDate },
    });
  },
};
