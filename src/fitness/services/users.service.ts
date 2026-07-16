import prisma from "../../lib/prisma";

export const usersService = {
  async lookupAlunoByEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== "ALUNO") {
      const err = new Error("Aluno não encontrado com este e-mail.");
      (err as any).statusCode = 404;
      throw err;
    }

    return { id: user.id, email: user.email, role: user.role };
  },
};
