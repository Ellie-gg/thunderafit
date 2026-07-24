import prisma from "../../lib/prisma";
import { relationsRepository } from "../repository/relations.repository";
import { notificationsService } from "../../notifications/services/notifications.service";

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export const relationsService = {
  async createRelation(
    personalId: string,
    alunoId: string,
    professionalType: "PERSONAL" | "NUTRICIONISTA"
  ) {
    // 1. Validate aluno exists and is ALUNO
    const aluno = await prisma.user.findUnique({ where: { id: alunoId } });
    if (!aluno || aluno.role !== "ALUNO") {
      const err = new Error("Aluno não encontrado ou role inválida.");
      (err as any).statusCode = 404;
      throw err;
    }

    // 2. Prevent duplicate
    const existing = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (existing) {
      const err = new Error("Vínculo já existe.");
      (err as any).statusCode = 409;
      throw err;
    }

    // 3. Check limit — a contagem já era filtrada por personalId específico
    // (o campo guarda o id do profissional autenticado, seja Personal ou
    // Nutricionista), então o limite Freemium já é por profissional, não
    // global sobre o aluno. Auditado na Fase 11, nenhuma mudança necessária
    // aqui além de aceitar professionalType.
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    if (!user) {
      const err = new Error("Profissional não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    const count = await relationsRepository.countByPersonal(personalId);
    if (count >= user.limiteAlunos) {
      const err = new Error("Limite de alunos atingido.");
      (err as any).statusCode = 403;
      throw err;
    }

    // 4. Create relation
    const relation = await relationsRepository.create(personalId, alunoId, professionalType);
    return relation;
  },

  async listRelations(personalId: string) {
    const relations = await relationsRepository.findAllByPersonal(personalId);
    // Antes fazia 1 findUnique por aluno (N+1) — agora é uma única query
    // batelada por todos os IDs de uma vez, com o resultado indexado num Map
    // pra preservar a ordem de `relations` na montagem final.
    const alunos = await prisma.user.findMany({
      where: { id: { in: relations.map((rel) => rel.alunoId) } },
    });
    const alunoById = new Map(alunos.map((aluno) => [aluno.id, aluno]));

    const result: Array<{
      id: string;
      email: string;
      avatarUrl: string | null;
      createdAt: Date;
      paymentReminderDueDate: Date | null;
      paymentReminderRecurring: boolean;
    }> = [];
    for (const rel of relations) {
      const aluno = alunoById.get(rel.alunoId);
      if (aluno) {
        result.push({
          id: aluno.id,
          email: aluno.email,
          avatarUrl: aluno.avatarUrl,
          createdAt: rel.createdAt,
          paymentReminderDueDate: rel.paymentReminderDueDate,
          paymentReminderRecurring: rel.paymentReminderRecurring,
        });
      }
    }
    return result;
  },

  /** Personal configura (ou desativa, com dueDate null) o lembrete de pagamento do vínculo. */
  async setPaymentReminder(
    personalId: string,
    alunoId: string,
    dueDate: Date | null,
    recurring: boolean
  ) {
    const existing = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (!existing) {
      const err = new Error("Vínculo não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    return relationsRepository.updatePaymentReminder(personalId, alunoId, dueDate, recurring);
  },

  /**
   * Chamado no login do aluno: dispara UMA notificação in-app por vínculo com
   * lembrete vencido. Mecanismo deliberadamente simples (checagem no login,
   * sem scheduler) — este projeto não tem nenhuma infraestrutura de cron
   * (Cloud Run escala a zero); o fundador escolheu essa opção "mais simples,
   * menos confiável" em vez de subir Cloud Scheduler + Terraform só pra isso.
   * "Já disparou" nunca precisa ser checado à parte: disparar sempre avança
   * (recorrente) ou limpa (não-recorrente) a própria paymentReminderDueDate.
   */
  async checkAndFireDueReminders(alunoId: string) {
    const now = new Date();
    const due = await relationsRepository.findDueRemindersForAluno(alunoId, now);
    if (due.length === 0) return;

    // Antes fazia 1 findUnique por lembrete vencido (N+1) — agora é uma
    // única query batelada por todos os personalId de uma vez, mesmo padrão
    // já usado em listRelations. notify()/advanceReminder() continuam
    // sequenciais por relação (escritas com efeito colateral, não leitura).
    const personals = await prisma.user.findMany({
      where: { id: { in: due.map((relation) => relation.personalId) } },
    });
    const personalById = new Map(personals.map((personal) => [personal.id, personal]));

    for (const relation of due) {
      const personal = personalById.get(relation.personalId);
      const label = personal?.name?.trim() || personal?.email || "seu Personal";
      await notificationsService.notify(
        alunoId,
        "payment_reminder",
        `Lembrete: ${label} sinalizou que é hoje o dia de acertar o pagamento combinado.`
      );
      const nextDueDate = relation.paymentReminderRecurring
        ? addOneMonth(relation.paymentReminderDueDate!)
        : null;
      await relationsRepository.advanceReminder(relation.id, nextDueDate);
    }
  },
};
