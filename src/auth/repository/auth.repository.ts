import prisma from "../../lib/prisma";
import { Role, PlanoAssinatura } from "@prisma/client";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: Role;
}

export const authRepository = {
  /**
   * Busca um usuário pelo e-mail.
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  /**
   * Cria um novo usuário.
   * planoAssinatura e limiteAlunos usam os defaults do schema Prisma.
   */
  async createUser(data: CreateUserInput) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        planoAssinatura: PlanoAssinatura.FREE,
        limiteAlunos: 3,
      },
    });
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
