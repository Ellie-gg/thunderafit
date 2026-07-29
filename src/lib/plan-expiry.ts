import prisma from "./prisma";
import { FREE_LIMITE_ALUNOS } from "../billing/stripe";

/**
 * Fase 90 — concessão manual de plano com prazo pelo admin ("brinde por
 * tempo limitado": Base/Plus grátis por N dias, sem passar pelo Stripe).
 * Checado sob demanda, sem cron/job separado — mesmo espírito já usado por
 * `alunoPremiumService.computeEntitlement` (nunca confia só no status
 * armazenado, sempre compara a data-limite contra `now()`). A diferença
 * aqui é que `planoAssinatura`/`limiteAlunos` são lidos como coluna crua em
 * vários lugares do código (ao contrário do entitlement do Aluno, sempre
 * funilado por uma função central) — por isso este helper AUTO-CORRIGE a
 * linha no banco quando expira, em vez de só computar um valor virtual, pra
 * qualquer leitor (conhecido ou futuro) já ver o dado certo sem precisar
 * passar por aqui.
 *
 * Nunca reduz uma assinatura Stripe REAL: o webhook
 * (`billing.repository.ts#applyPaidPlan`/`applyFreePlan`) sempre limpa
 * `planoAssinaturaExpiresAt` em toda escrita — esse campo só sobrevive não
 * nulo quando o plano atual veio de uma concessão manual.
 */
export async function revertExpiredPersonalPlan<
  T extends { id: string; planoAssinaturaExpiresAt: Date | null },
>(user: T): Promise<T> {
  if (!user.planoAssinaturaExpiresAt || user.planoAssinaturaExpiresAt.getTime() > Date.now()) {
    return user;
  }
  // `select` explícito (não o objeto inteiro do Prisma) — o retorno é
  // espalhado de volta em `user` (que pode vir de um SELECT parcial, ex: a
  // listagem de admin), e um update() sem select traria passwordHash/
  // refreshTokenHash junto, vazando campos sensíveis pro chamador.
  const reverted = await prisma.user.update({
    where: { id: user.id },
    data: {
      planoAssinatura: "FREE",
      limiteAlunos: FREE_LIMITE_ALUNOS,
      planoAssinaturaExpiresAt: null,
    },
    select: { planoAssinatura: true, limiteAlunos: true, planoAssinaturaExpiresAt: true },
  });
  return { ...user, ...reverted };
}
