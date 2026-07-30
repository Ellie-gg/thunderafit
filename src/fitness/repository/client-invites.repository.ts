import prisma from "../../lib/prisma";

export const clientInvitesRepository = {
  async create(
    personalId: string,
    professionalType: "PERSONAL" | "NUTRICIONISTA",
    label: string,
    tokenHash: string,
    expiresAt: Date
  ) {
    return prisma.clientInvite.create({
      data: { personalId, professionalType, label, tokenHash, expiresAt },
    });
  },

  async findById(id: string) {
    return prisma.clientInvite.findUnique({ where: { id } });
  },

  async findByTokenHash(tokenHash: string) {
    return prisma.clientInvite.findUnique({ where: { tokenHash } });
  },

  /** Convites ainda não consumidos — inclui expirados de propósito (o
   * Personal precisa ver que existem pra decidir revogar/criar outro, em
   * vez de um convite simplesmente sumir sem explicação). */
  async findActiveByPersonal(personalId: string) {
    return prisma.clientInvite.findMany({
      where: { personalId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async delete(id: string) {
    return prisma.clientInvite.delete({ where: { id } });
  },

  /**
   * Atualização condicional atômica: só "ganha" a corrida quem encontrar
   * `consumedAt: null` no momento exato do UPDATE — protege contra 2
   * chamadas concorrentes tentando consumir o MESMO token ao mesmo tempo
   * (ex: 2 abas). `count === 0` significa que outra chamada já consumiu
   * primeiro (ou o convite não existe mais).
   */
  async tryConsume(id: string, alunoId: string): Promise<boolean> {
    const result = await prisma.clientInvite.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date(), consumedByAlunoId: alunoId },
    });
    return result.count === 1;
  },
};
