import prisma from "../../lib/prisma";
import { FREE_LIMITE_ALUNOS, BASE_LIMITE_ALUNOS, PLUS_LIMITE_ALUNOS, PlanTier } from "../stripe";

export const billingRepository = {
  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findUserByStripeCustomerId(stripeCustomerId: string) {
    return prisma.user.findUnique({ where: { stripeCustomerId } });
  },

  setStripeCustomerId(userId: string, stripeCustomerId: string) {
    return prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  },

  /**
   * Registra o vínculo com o Stripe (customer + subscription) SEM mudar o
   * plano. Usado quando o checkout completa mas o pagamento ainda não
   * confirmou (boleto/Pix): guardamos a subscription corrente para casar os
   * eventos futuros, mas o usuário só vira PAGO quando o pagamento entra.
   */
  linkStripe(userId: string, stripeCustomerId: string, stripeSubscriptionId: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId, stripeSubscriptionId },
    });
  },

  /** Upgrade: BASE ou PLUS + limite do degrau + guarda a subscription. Idempotente. */
  applyPaidPlan(userId: string, tier: PlanTier, stripeSubscriptionId: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        planoAssinatura: tier,
        limiteAlunos: tier === "PLUS" ? PLUS_LIMITE_ALUNOS : BASE_LIMITE_ALUNOS,
        stripeSubscriptionId,
      },
    });
  },

  /**
   * Downgrade: FREE + limite 3. NÃO desfaz vínculos existentes — o enforcement
   * de limite (relations.service) só roda na CRIAÇÃO de vínculo, então baixar
   * o limite bloqueia NOVOS vínculos além de 3 mas mantém intactos os alunos
   * já vinculados (decisão documentada, Fase 20). Zera a subscription corrente
   * — assim eventos obsoletos daquela subscription deixam de casar e não
   * reativam o plano por engano (defesa contra reordenação/reentrega).
   *
   * `availableForNewStudents: false` (bug corrigido nesta fase): antes do
   * degrau de 3 níveis, um downgrade pra FREE não desligava a disponibilidade
   * no diretório — o profissional continuava aparecendo pros alunos mesmo
   * sem mais direito a isso (Base+ é quem pode ficar disponível).
   */
  applyFreePlan(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        planoAssinatura: "FREE",
        limiteAlunos: FREE_LIMITE_ALUNOS,
        stripeSubscriptionId: null,
        availableForNewStudents: false,
      },
    });
  },
};
