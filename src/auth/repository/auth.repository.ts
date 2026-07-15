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
};
