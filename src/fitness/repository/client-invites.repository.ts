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

  /**
   * F2 (auditoria 2026-07-31): desfaz `tryConsume` — usado quando o vínculo
   * (`relationsService.createRelation`) falha DEPOIS do convite já ter sido
   * marcado como consumido (ex: limite de alunos mudou nesse meio-tempo,
   * duplicata). Sem isso, o convite ficava permanentemente inutilizável —
   * `revokeInvite` recusa convite já consumido, e ele desaparece da lista
   * de pendentes (`findActiveByPersonal` filtra `consumedAt: null`) — o
   * aluno tinha conta criada mas NENHUM vínculo, e nem o Personal nem o
   * aluno tinham como tentar de novo com o mesmo link. Condicional em
   * `alunoId` (não só `id`) por segurança: nunca desfaz o consumo de OUTRO
   * aluno por engano.
   */
  async unconsume(id: string, alunoId: string): Promise<void> {
    await prisma.clientInvite.updateMany({
      where: { id, consumedByAlunoId: alunoId },
      data: { consumedAt: null, consumedByAlunoId: null },
    });
  },
};
