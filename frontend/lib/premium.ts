import type { AdminUser } from "./types";

/**
 * "Este usuário tem acesso Premium AGORA?" — para a coluna Premium do painel
 * admin (`app/nimbus/usuarios/page.tsx`).
 *
 * Vive aqui, fora da página, porque é um predicado puro e sutil o suficiente
 * pra merecer teste próprio: as duas regras abaixo são DIFERENTES de
 * propósito e não dá pra unificar numa só.
 *
 * - **ALUNO**: espelha `alunoPremiumService.computeEntitlement` no backend —
 *   status != NONE **E** `alunoPremiumExpiresAt` no futuro. Prazo ausente
 *   significa SEM acesso (uma concessão do admin sempre grava uma sentinela
 *   de 100 anos, e o teste grátis sempre grava 7 dias — então "sem prazo"
 *   nunca é um estado legítimo de acesso pro aluno).
 * - **PERSONAL/NUTRICIONISTA**: `planoAssinatura != "FREE"`, e prazo NULO
 *   significa PERMANENTE (assinatura real via Stripe, sem data de fim).
 *
 * Bug que isto corrige (reportado pelo fundador): a checagem do ALUNO olhava
 * só `alunoPremiumStatus`, ignorando o prazo. Como NADA reescreve o status
 * pra NONE quando vence (não existe cron — a verdade é sempre computada na
 * leitura, ver `src/billing/services/aluno-premium.service.ts`), um aluno com
 * o teste grátis vencido ficava aparecendo como "Premium ativo (permanente)"
 * pra sempre no painel, contradizendo o app — que corretamente negava o
 * acesso. Do lado PERSONAL o mesmo descompasso é transitório e se cura
 * sozinho, porque `revertExpiredPersonalPlan` (`src/lib/plan-expiry.ts`)
 * reescreve `planoAssinatura` no banco quando o prazo passa.
 */
export function hasActivePremium(
  user: Pick<
    AdminUser,
    "role" | "alunoPremiumStatus" | "alunoPremiumExpiresAt" | "planoAssinatura" | "planoAssinaturaExpiresAt"
  >
): boolean {
  if (user.role === "ALUNO") {
    return (
      user.alunoPremiumStatus != null &&
      user.alunoPremiumStatus !== "NONE" &&
      isInFuture(user.alunoPremiumExpiresAt)
    );
  }
  // PERSONAL/NUTRICIONISTA (ADMIN nem chega aqui — a coluna não é renderizada
  // pra esse role): prazo nulo = permanente.
  return (
    user.planoAssinatura !== "FREE" &&
    (user.planoAssinaturaExpiresAt == null || isInFuture(user.planoAssinaturaExpiresAt))
  );
}

function isInFuture(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  // Data inválida (`NaN`) nunca conta como acesso vigente.
  return Number.isFinite(t) && t > Date.now();
}
