import type { User } from "@prisma/client";

/**
 * Extraído de `src/auth/services/auth.service.ts` (Fase 81) pra ser
 * reaproveitado também pelo domínio admin (Fase 90): `passwordHash`/
 * `refreshTokenHash` e os 4 campos de token (verificação de e-mail + reset
 * de senha) nunca podem vazar pro cliente — mesmo hasheados, são segredos
 * de posse. Qualquer resposta de API que devolve um `User` inteiro (direto
 * de um `prisma.user.*` sem `select`) deve passar por aqui antes de sair.
 */
export function toSafeUser(user: User) {
  const {
    passwordHash: _ph,
    refreshTokenHash: _rth,
    emailVerificationTokenHash: _evth,
    emailVerificationTokenExpiresAt: _evte,
    passwordResetTokenHash: _prth,
    passwordResetTokenExpiresAt: _prte,
    ...safeUser
  } = user;
  return safeUser;
}
