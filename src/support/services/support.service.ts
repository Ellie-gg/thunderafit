import prisma from "../../lib/prisma";
import { supportRepository } from "../repository/support.repository";
import { notificationsService } from "../../notifications/services/notifications.service";

function notFound(message: string): never {
  const err = new Error(message);
  (err as any).statusCode = 404;
  throw err;
}

function forbidden(message: string): never {
  const err = new Error(message);
  (err as any).statusCode = 403;
  throw err;
}

export const supportService = {
  /**
   * Profissionais vinculados a este aluno (Personal E Nutricionista) — usado
   * pelo frontend para o aluno escolher o destinatário da dúvida. Fase 17
   * (Item 6): passa a incluir `professionalType` para a UI distinguir/rotular
   * Personal vs Nutricionista (a tabela ClientRelation já guardava ambos).
   */
  async listMyPersonals(alunoId: string) {
    const relations = await supportRepository.findPersonalsForAluno(alunoId);
    const withUser = await Promise.all(
      relations.map(async (r) => {
        const u = await prisma.user.findUnique({ where: { id: r.personalId } });
        return u ? { id: u.id, email: u.email, professionalType: r.professionalType } : null;
      })
    );
    return withUser.filter((p): p is NonNullable<typeof p> => !!p);
  },

  async createThread(alunoId: string, personalId: string, subject: string, message: string) {
    const relation = await supportRepository.findRelation(personalId, alunoId);
    if (!relation) {
      forbidden("Você não está vinculado a este Personal Trainer.");
    }

    const thread = await supportRepository.createThreadWithFirstMessage(
      alunoId,
      personalId,
      subject,
      message
    );

    // Gatilho de notificação 1/2 (Fase 10): novo pedido de dúvida notifica o Personal.
    await notificationsService.notify(
      personalId,
      "support_new_thread",
      `Novo pedido de dúvida: "${subject}"`
    );

    return thread;
  },

  async listThreads(userId: string, role: "ALUNO" | "PERSONAL" | "NUTRICIONISTA") {
    return supportRepository.findThreadsForUser(userId, role);
  },

  async getThread(threadId: string, userId: string, role?: string) {
    const thread = await supportRepository.findThreadById(threadId);
    if (!thread) notFound("Dúvida não encontrada.");
    if (role !== "ADMIN" && thread.alunoId !== userId && thread.personalId !== userId) {
      forbidden("Você não tem permissão para acessar esta dúvida.");
    }
    return thread;
  },

  async addMessage(
    threadId: string,
    authorId: string,
    role: "ALUNO" | "PERSONAL" | "NUTRICIONISTA",
    text: string
  ) {
    const thread = await supportRepository.findThreadById(threadId);
    if (!thread) notFound("Dúvida não encontrada.");
    if (thread.alunoId !== authorId && thread.personalId !== authorId) {
      forbidden("Você não tem permissão para responder esta dúvida.");
    }

    const message = await supportRepository.addMessage(threadId, authorId, text);

    // Fase 17 (Item 6): Nutricionista responde como profissional, igual ao
    // Personal (marca RESPONDIDO + notifica o aluno). Antes caía no `else` e
    // era tratado erroneamente como o aluno reabrindo a thread.
    const isProfessional = role === "PERSONAL" || role === "NUTRICIONISTA";
    if (isProfessional) {
      await supportRepository.setThreadStatus(threadId, "RESPONDIDO");
      // Gatilho de notificação 2/2 (Fase 10): resposta do Personal notifica o aluno.
      await notificationsService.notify(
        thread.alunoId,
        "support_reply",
        `Sua dúvida "${thread.subject}" foi respondida.`
      );
    } else if (thread.status === "RESPONDIDO") {
      // Aluno reabre a dúvida com uma nova pergunta na mesma thread.
      await supportRepository.setThreadStatus(threadId, "ABERTO");
      await notificationsService.notify(
        thread.personalId,
        "support_new_thread",
        `Nova mensagem na dúvida: "${thread.subject}"`
      );
    }

    return message;
  },
};
