import prisma from "./prisma";
import { FREE_LIMITE_ALUNOS, BASE_LIMITE_ALUNOS, PLUS_LIMITE_ALUNOS, getStripe, tierForPriceId } from "../billing/stripe";

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
 * Nunca reduz uma assinatura Stripe REAL — mas essa invariante só valia na
 * ordem "concessão manual primeiro, Stripe depois" (o webhook sempre limpa
 * `planoAssinaturaExpiresAt` em toda escrita real). Achado real (auditoria
 * 2026-07-31, B3): na ordem inversa — Personal JÁ é assinante Stripe pagante
 * e o admin concede uma cortesia por cima (`planoAssinaturaExpiresAt`
 * setado sem tocar `stripeSubscriptionId`) — a invariante quebrava: ao
 * vencer a cortesia, esta função revertia direto pra FREE, rebaixando um
 * cliente que o Stripe continuava cobrando normalmente. Corrigido: quando
 * `stripeSubscriptionId` está presente, sincroniza com o estado AO VIVO da
 * assinatura no Stripe em vez de assumir FREE — só cai no fallback FREE se
 * a assinatura já não existir mais lá também (ou se a consulta ao Stripe
 * falhar, caso em que loga e usa o fallback mais conservador).
 */
export async function revertExpiredPersonalPlan<
  T extends { id: string; planoAssinaturaExpiresAt: Date | null; stripeSubscriptionId?: string | null },
>(user: T): Promise<T> {
  if (!user.planoAssinaturaExpiresAt || user.planoAssinaturaExpiresAt.getTime() > Date.now()) {
    return user;
  }

  if (user.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      const liveSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const ativo = liveSub.status === "active" || liveSub.status === "trialing";
      if (ativo) {
        const priceId = liveSub.items?.data?.[0]?.price?.id;
        const tier = priceId ? tierForPriceId(priceId) : "BASE";
        const reverted = await prisma.user.update({
          where: { id: user.id },
          data: {
            planoAssinatura: tier,
            limiteAlunos: tier === "PLUS" ? PLUS_LIMITE_ALUNOS : BASE_LIMITE_ALUNOS,
            planoAssinaturaExpiresAt: null,
          },
          select: { planoAssinatura: true, limiteAlunos: true, planoAssinaturaExpiresAt: true },
        });
        return { ...user, ...reverted };
      }
      // Assinatura existe no Stripe mas não está ativa — cai no fallback
      // FREE abaixo (mesmo destino que `applyInactivePlan` já daria).
    } catch (err) {
      console.warn(
        `[plan-expiry] Falha ao consultar assinatura Stripe ao reverter concessão expirada (userId=${user.id}): ${(err as Error).message} — usando fallback FREE.`
      );
    }
  }

  // `select` explícito (não o objeto inteiro do Prisma) — o retorno é
  // espalhado de volta em `user` (que pode vir de um SELECT parcial, ex: a
  // listagem de admin), e um update() sem select traria passwordHash/
  // refreshTokenHash junto, vazando campos sensíveis pro chamador.
  //
  // B7 (auditoria 2026-07-31): `availableForNewStudents: false` — mesmo
  // ajuste de `admin.repository.ts#setPersonalPlano`, pelo mesmo motivo
  // (`applyFreePlan`, o downgrade via webhook, já desliga isto; este
  // caminho — expiração de concessão manual — não desligava).
  const reverted = await prisma.user.update({
    where: { id: user.id },
    data: {
      planoAssinatura: "FREE",
      limiteAlunos: FREE_LIMITE_ALUNOS,
      planoAssinaturaExpiresAt: null,
      availableForNewStudents: false,
    },
    select: { planoAssinatura: true, limiteAlunos: true, planoAssinaturaExpiresAt: true },
  });
  return { ...user, ...reverted };
}

/**
 * Fase 103 — quando um Personal (ou Nutricionista) cai pra um plano com
 * `limiteAlunos` menor que a quantidade de `ClientRelation` já vinculada
 * (downgrade, cancelamento no Stripe, ou concessão manual do admin vencida),
 * os vínculos existentes continuam intactos (decisão da Fase 20, ver
 * billing.repository.ts) — mas depois de uma carência, prescrever/editar
 * treino pros alunos já vinculados passa a ficar bloqueado até o Personal
 * desvincular alunos suficientes pra voltar dentro do limite.
 *
 * `overLimiteAlunosSince` marca desde QUANDO o excesso começou — sem cron,
 * computado sob demanda (mesmo espírito de `revertExpiredPersonalPlan`
 * acima): a PRIMEIRA chamada que detecta o excesso grava o timestamp; uma
 * chamada seguinte que encontra a contagem de volta dentro do limite limpa
 * o campo (recuperação). Chamado a partir de QUALQUER ponto que precise
 * decidir se uma ação de prescrição (Personal) ou de acesso (aluno, pelo
 * `personalId` do programa/treino específico) deve ser bloqueada — nunca só
 * uma vez num único lugar central, porque o aluno acessa pelo `personalId`
 * do PROGRAMA (pode ser diferente do usuário autenticado na requisição).
 *
 * `personalId` nulo (programa/treino `origin: SELF`, sem profissional dono)
 * sempre retorna "não bloqueado" — não há Personal nenhum pra checar.
 *
 * Custo: 2 queries no caso comum (usuário + contagem de vínculos), mais 1
 * write só na transição de estado (entrar ou sair do excesso). Aceitável
 * pelo volume real já mapeado nesta sessão (ceilings de `limiteAlunos` bem
 * pequenos); se algum dia isso pesar num caminho quente (ex: execução de
 * treino do aluno), dá pra cachear/desnormalizar sem mudar a assinatura
 * desta função.
 */
export const PERSONAL_OVER_LIMIT_GRACE_DAYS = 5;

export interface PersonalAccessStatus {
  /** true = passou da carência, ações de prescrição/acesso devem ser recusadas. */
  blocked: boolean;
  /** true = acima do limite agora (pode ainda estar dentro da carência). */
  overLimit: boolean;
  /** Dias restantes de carência, ou null quando não se aplica (dentro do limite, ou já bloqueado). */
  graceDaysLeft: number | null;
}

export async function getPersonalAccessStatus(
  personalId: string | null
): Promise<PersonalAccessStatus> {
  if (!personalId) return { blocked: false, overLimit: false, graceDaysLeft: null };

  let user = await prisma.user.findUnique({
    where: { id: personalId },
    select: {
      id: true,
      limiteAlunos: true,
      planoAssinaturaExpiresAt: true,
      overLimiteAlunosSince: true,
      stripeSubscriptionId: true,
    },
  });
  if (!user) return { blocked: false, overLimit: false, graceDaysLeft: null };

  user = await revertExpiredPersonalPlan(user);
  const count = await prisma.clientRelation.count({ where: { personalId } });

  if (count <= user.limiteAlunos) {
    if (user.overLimiteAlunosSince) {
      await prisma.user.update({ where: { id: personalId }, data: { overLimiteAlunosSince: null } });
    }
    return { blocked: false, overLimit: false, graceDaysLeft: null };
  }

  let since = user.overLimiteAlunosSince;
  if (!since) {
    since = new Date();
    await prisma.user.update({ where: { id: personalId }, data: { overLimiteAlunosSince: since } });
  }
  const daysElapsed = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
  if (daysElapsed >= PERSONAL_OVER_LIMIT_GRACE_DAYS) {
    return { blocked: true, overLimit: true, graceDaysLeft: null };
  }
  return {
    blocked: false,
    overLimit: true,
    graceDaysLeft: Math.max(1, Math.ceil(PERSONAL_OVER_LIMIT_GRACE_DAYS - daysElapsed)),
  };
}

function httpError(message: string, statusCode: number, code: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Usado nos caminhos de PRESCRIÇÃO do Personal (criar/adicionar treino,
 * aplicar template/catálogo a um aluno) — `personalId` é sempre o autor
 * autenticado da ação, nunca o dono de um programa de terceiro. Deletar/
 * mover/salvar-como-template nunca passam por aqui (mesma filosofia já
 * usada pelo Aluno Premium: remoção nunca é bloqueada, só o que EXPANDE a
 * prescrição).
 */
export async function assertPersonalCanPrescribe(personalId: string): Promise<void> {
  const status = await getPersonalAccessStatus(personalId);
  if (status.blocked) {
    throw httpError(
      `Você tem mais alunos vinculados do que seu plano atual permite. Desvincule alunos até ficar dentro do limite antes de prescrever novos treinos.`,
      403,
      "PERSONAL_OVER_LIMIT"
    );
  }
}

/**
 * Usado nos caminhos de ACESSO do aluno (ver/completar treino, registrar
 * série) — `personalId` é sempre o dono do PROGRAMA/TREINO específico sendo
 * acessado (`program.personalId`/`workout.personalId`), nunca o usuário
 * autenticado da requisição (que é o aluno). Nulo (programa origin: SELF)
 * nunca bloqueia — resolvido dentro de `getPersonalAccessStatus`.
 *
 * `alunoId` (auditoria 2026-07-31, X8): antes, um aluno DESVINCULADO daquele
 * Personal continuava sujeito ao estado de plano dele enquanto usasse um
 * programa antigo — mesmo sem nenhum `ClientRelation` vigente. O propósito
 * inteiro deste bloqueio é pressionar o Personal a desvincular alunos (ou
 * pagar) pra sair do excesso; uma vez que o aluno JÁ foi desvinculado, ele
 * não é mais parte do que está causando o excesso, então continuar
 * bloqueando o acesso dele não serve o mecanismo — só pune sem motivo. A
 * checagem de vínculo só roda quando `status.blocked` já é `true` (evita 1
 * query a mais no caminho comum, onde quase sempre não está bloqueado).
 */
export async function assertAlunoWorkoutAccessible(personalId: string | null, alunoId: string): Promise<void> {
  const status = await getPersonalAccessStatus(personalId);
  if (!status.blocked) return;

  const relation = await prisma.clientRelation.findUnique({
    where: { personalId_alunoId: { personalId: personalId as string, alunoId } },
  });
  if (!relation) return;

  throw httpError(
    "Seu Personal precisa regularizar a assinatura dele para você voltar a acessar este treino.",
    403,
    "PERSONAL_PLAN_RESTRICTED"
  );
}
