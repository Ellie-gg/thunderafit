import prisma from "../../lib/prisma";
import { Role, PlanoAssinatura, Locale } from "@prisma/client";

export interface CreateUserInput {
  email: string;
  // Fase 77: nullable — conta criada via Google SSO nunca recebe senha própria.
  passwordHash: string | null;
  role: Role;
  name?: string | null;
  googleId?: string | null;
}

// A2 (auditoria 2026-07-31): `email` é `@unique` no Postgres — comparação
// CASE-SENSITIVE. Nada no domínio normalizava (nem register, nem login, nem
// check-email, nem SSO Google, nem forgot-password) — só o rate limiter de
// login já fazia `.trim().toLowerCase()`. Consequência real: `Joao@x.com` e
// `joao@x.com` viravam 2 contas diferentes (2ª tentativa de cadastro nunca
// via conflito), e o auto-link do SSO Google (Fase 77, "on purpose") deixava
// de funcionar se o Google devolvesse o e-mail em uma caixa diferente da
// gravada. Normalizado aqui — o ÚNICO ponto de leitura/escrita de e-mail do
// domínio auth (confirmado por grep: nenhum outro arquivo chama
// `authRepository.findByEmail`/`createUser`) — para que todo chamador atual
// e futuro herde o comportamento sem precisar lembrar de normalizar.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const authRepository = {
  /**
   * Busca um usuário pelo e-mail (normalizado).
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  },

  /**
   * Cria um novo usuário.
   * planoAssinatura e limiteAlunos usam os defaults do schema Prisma.
   */
  async createUser(data: CreateUserInput) {
    return prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        passwordHash: data.passwordHash,
        role: data.role,
        name: data.name ?? null,
        googleId: data.googleId ?? null,
        planoAssinatura: PlanoAssinatura.FREE,
        limiteAlunos: 3,
      },
    });
  },

  /** Fase 77 (SSO Google): busca por sub do Google (estável mesmo se o e-mail mudar). */
  async findByGoogleId(googleId: string) {
    return prisma.user.findUnique({ where: { googleId } });
  },

  /** Vincula uma conta tradicional já existente ao Google (1ª vez que entra via Google). */
  async linkGoogleId(userId: string, googleId: string) {
    return prisma.user.update({ where: { id: userId }, data: { googleId } });
  },

  /**
   * Atualiza o hash do refresh token do usuário.
   * Passar null invalida todos os refresh tokens existentes (logout).
   */
  async updateRefreshTokenHash(userId: string, hash: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  },

  /**
   * Busca um usuário pelo ID.
   */
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  /**
   * Fase 30: atualiza a foto de perfil. `null` remove o avatar.
   */
  async updateAvatar(userId: string, avatarUrl: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  },

  /** Fase 80: troca (ou define, pra conta Google sem senha própria) o passwordHash. */
  async updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  /** i18n: escolha explícita de idioma (Configurações). `null` volta a detectar automaticamente. */
  async updateLocale(userId: string, locale: Locale | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
  },

  // --- Fase 81: confirmação de e-mail ---

  async setEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerificationTokenHash: tokenHash, emailVerificationTokenExpiresAt: expiresAt },
    });
  },

  /** Marca como verificado E limpa o token (não fica reutilizável depois de usado). */
  async markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });
  },

  /** Fase 77: conta Google já nasce com o e-mail verificado (o próprio Google já confirmou). */
  async markEmailVerifiedAt(userId: string, date: Date) {
    return prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: date } });
  },

  // --- Fase 81: "esqueci minha senha" ---

  async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: expiresAt },
    });
  },

  async clearPasswordResetToken(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordResetTokenHash: null, passwordResetTokenExpiresAt: null },
    });
  },

  /** Fase 81: guarda contra auto-remoção do último ADMIN (mesmo padrão do admin domain). */
  async countAdmins() {
    return prisma.user.count({ where: { role: "ADMIN" } });
  },

  /**
   * Registra um login bem-sucedido: atualiza `lastLoginAt` (consulta rápida
   * para a listagem de usuários do admin) e grava uma linha em `LoginLog`
   * (histórico completo, append-only — só de logins que deram certo;
   * tentativas falhas alimentam apenas o rate limiter em memória).
   */
  async recordLogin(userId: string, ipAddress: string | null) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      }),
      prisma.loginLog.create({
        data: { userId, ipAddress },
      }),
    ]);
  },
};
