import prisma from "../../lib/prisma";
import { AlunoPremiumStatus } from "@prisma/client";

export const alunoPremiumRepository = {
  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  /**
   * Fase 56: início do teste grátis — grava o status + a data-limite E o
   * "carimbo" de uso (nunca mais limpo) na mesma escrita, pra não haver
   * janela entre "concedeu acesso" e "marcou como usado".
   */
  startTrial(userId: string, expiresAt: Date, usedAt: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        alunoPremiumStatus: AlunoPremiumStatus.TRIAL,
        alunoPremiumExpiresAt: expiresAt,
        alunoTrialUsedAt: usedAt,
      },
    });
  },
};
