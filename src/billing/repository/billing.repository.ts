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

  /**
   * Upgrade: BASE ou PLUS + limite do degrau + guarda a subscription.
   * Idempotente. Fase 90: sempre limpa `planoAssinaturaExpiresAt` — uma
   * assinatura Stripe REAL nunca deve carregar um prazo de concessão manual
   * residual de uma "brinde" anterior do admin.
   */
  applyPaidPlan(userId: string, tier: PlanTier, stripeSubscriptionId: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        planoAssinatura: tier,
        limiteAlunos: tier === "PLUS" ? PLUS_LIMITE_ALUNOS : BASE_LIMITE_ALUNOS,
        stripeSubscriptionId,
        planoAssinaturaExpiresAt: null,
        // B5 (auditoria 2026-07-31): sem isso, quem pagava JUSTAMENTE pra
        // sair do bloqueio de excesso de alunos (Fase 103) continuava
        // bloqueado imediatamente após pagar — o timestamp de excesso
        // antigo sobrevivia ao upgrade, e se o novo limite ainda não
        // cobrisse todos os alunos (ex: 25 alunos, upgrade só pra BASE/20),
        // a carência de 5 dias já contada antes do pagamento persistia. Um
        // upgrade de plano merece uma carência NOVA — `getPersonalAccessStatus`
        // recria o timestamp do zero na próxima checagem se ainda estiver
        // acima do limite.
        overLimiteAlunosSince: null,
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
   * Só para `customer.subscription.deleted` — a subscription realmente
   * deixou de existir no Stripe, então não há nada pra "recuperar" depois.
   * Ver `applyInactivePlan` abaixo para o caso `updated` com status não-ativo
   * (a subscription ainda existe, só não está cobrando agora).
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
        planoAssinaturaExpiresAt: null,
      },
    });
  },

  /**
   * Downgrade pra FREE igual a `applyFreePlan`, MAS mantém `stripeSubscriptionId`
   * — achado real (auditoria 2026-07-31): usado quando `customer.subscription.updated`
   * chega com um status não-ativo (`past_due`, `unpaid`, `incomplete`...) — a
   * subscription no Stripe ainda EXISTE, só não está cobrando agora. Zerar o
   * id ali (como `applyFreePlan` faz) quebra a recuperação: quando o cliente
   * atualiza o cartão e o Stripe volta a marcar a MESMA subscription como
   * `active`, o guard de reordenação em `billing.service.ts`
   * (`user.stripeSubscriptionId !== sub.id`) rejeitava o evento de
   * recuperação porque o id já tinha sido apagado — o plano nunca voltava,
   * mesmo com o Stripe cobrando normalmente todo mês depois. Manter o id
   * aqui não reabre a corrida que `applyFreePlan` evita: essa defesa é sobre
   * um evento obsoleto reentregue APÓS a subscription ter sido cancelada de
   * verdade (`deleted`, que continua zerando o id) — nunca sobre a mesma
   * subscription ainda viva voltando a ficar ativa.
   */
  applyInactivePlan(userId: string, stripeSubscriptionId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        planoAssinatura: "FREE",
        limiteAlunos: FREE_LIMITE_ALUNOS,
        stripeSubscriptionId,
        availableForNewStudents: false,
        planoAssinaturaExpiresAt: null,
      },
    });
  },
};
