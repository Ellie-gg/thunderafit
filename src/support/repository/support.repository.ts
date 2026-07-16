import prisma from "../../lib/prisma";

export const supportRepository = {
  /**
   * Consulta ClientRelation direto via Prisma em vez de importar algo de
   * `/src/fitness` — o domínio de vínculos não expõe (ainda) um lookup
   * reverso "quais Personals este aluno tem", e adicionar isso ao módulo
   * fitness ficaria fora do escopo de arquivos desta fase. A tabela é
   * compartilhada no mesmo schema, então consultá-la diretamente aqui não
   * duplica lógica de negócio — só lê o vínculo já existente.
   */
  async findRelation(personalId: string, alunoId: string) {
    return prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
  },

  async findPersonalsForAluno(alunoId: string) {
    return prisma.clientRelation.findMany({ where: { alunoId } });
  },

  async createThreadWithFirstMessage(
    alunoId: string,
    personalId: string,
    subject: string,
    firstMessageText: string
  ) {
    return prisma.supportThread.create({
      data: {
        alunoId,
        personalId,
        subject,
        messages: { create: { authorId: alunoId, text: firstMessageText } },
      },
      include: { messages: true },
    });
  },

  async findThreadsForUser(userId: string, role: "ALUNO" | "PERSONAL") {
    const where = role === "ALUNO" ? { alunoId: userId } : { personalId: userId };
    return prisma.supportThread.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  },

  async findThreadById(id: string) {
    return prisma.supportThread.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  async addMessage(threadId: string, authorId: string, text: string) {
    return prisma.supportMessage.create({ data: { threadId, authorId, text } });
  },

  async setThreadStatus(threadId: string, status: "ABERTO" | "RESPONDIDO") {
    return prisma.supportThread.update({ where: { id: threadId }, data: { status } });
  },
};
