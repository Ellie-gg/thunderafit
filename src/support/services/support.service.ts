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
  /** Personals vinculados a este aluno — usado pelo frontend para saber a quem perguntar. */
  async listMyPersonals(alunoId: string) {
    const relations = await supportRepository.findPersonalsForAluno(alunoId);
    const personals = await Promise.all(
      relations.map((r) => prisma.user.findUnique({ where: { id: r.personalId } }))
    );
    return personals
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ id: p.id, email: p.email }));
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

  async listThreads(userId: string, role: "ALUNO" | "PERSONAL") {
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

  async addMessage(threadId: string, authorId: string, role: "ALUNO" | "PERSONAL", text: string) {
    const thread = await supportRepository.findThreadById(threadId);
    if (!thread) notFound("Dúvida não encontrada.");
    if (thread.alunoId !== authorId && thread.personalId !== authorId) {
      forbidden("Você não tem permissão para responder esta dúvida.");
    }

    const message = await supportRepository.addMessage(threadId, authorId, text);

    if (role === "PERSONAL") {
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
