import { AlunoPremiumStatus, User } from "@prisma/client";
import { alunoPremiumRepository } from "../repository/aluno-premium.repository";
import { ALUNO_PREMIUM_TRIAL_DAYS } from "../stripe";

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export interface AlunoPremiumEntitlement {
  status: AlunoPremiumStatus;
  hasAccess: boolean;
  premiumExpiresAt: Date | null;
  trialAvailable: boolean;
}

/**
 * Fase 56 (Aluno Premium — guardrails): deriva o acesso EFETIVO sempre a
 * partir de `alunoPremiumExpiresAt` comparado ao agora — nunca confia cegamente
 * no `alunoPremiumStatus` armazenado (não existe job/cron que reescreva o
 * status pra NONE quando expira, mesmo espírito de
 * `workoutSummaryService`/`checkAndFireDueReminders`: computar a verdade em
 * tempo de leitura em vez de manter um segundo estado que pode dessincronizar).
 * TRIAL/ACTIVE/CANCELED com prazo no futuro concedem acesso; qualquer um
 * deles com prazo vencido, ou NONE, não concede.
 */
export const alunoPremiumService = {
  computeEntitlement(user: Pick<User, "alunoPremiumStatus" | "alunoPremiumExpiresAt" | "alunoTrialUsedAt">): AlunoPremiumEntitlement {
    const notExpired = !!user.alunoPremiumExpiresAt && user.alunoPremiumExpiresAt.getTime() > Date.now();
    const hasAccess = user.alunoPremiumStatus !== "NONE" && notExpired;
    return {
      status: user.alunoPremiumStatus,
      hasAccess,
      premiumExpiresAt: user.alunoPremiumExpiresAt,
      trialAvailable: !user.alunoTrialUsedAt,
    };
  },

  async getEntitlement(userId: string): Promise<AlunoPremiumEntitlement> {
    const user = await alunoPremiumRepository.findUserById(userId);
    if (!user) throw httpError("Usuário não encontrado.", 404);
    return this.computeEntitlement(user);
  },

  /**
   * Concede o teste grátis de 7 dias — uma única vez por conta, pra sempre
   * (`alunoTrialUsedAt` nunca é limpo, nem por cancelamento). Bloqueia tanto
   * quem já usou o teste quanto quem já tem acesso vigente agora (evita
   * "reiniciar" um teste em andamento pra esticar o prazo).
   */
  async startTrial(userId: string): Promise<AlunoPremiumEntitlement> {
    const user = await alunoPremiumRepository.findUserById(userId);
    if (!user) throw httpError("Usuário não encontrado.", 404);
    if (user.role !== "ALUNO") {
      throw httpError("Apenas alunos podem iniciar o teste grátis.", 403);
    }
    if (user.alunoTrialUsedAt) {
      throw httpError("O teste grátis já foi utilizado nesta conta.", 409);
    }
    const current = this.computeEntitlement(user);
    if (current.hasAccess) {
      throw httpError("Você já tem acesso Premium ativo.", 409);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ALUNO_PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const updated = await alunoPremiumRepository.startTrial(userId, expiresAt, now);
    return this.computeEntitlement(updated);
  },
};
