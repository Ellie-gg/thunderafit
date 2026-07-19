import prisma from "../../lib/prisma";
import { relationsRepository } from "../repository/relations.repository";

export const relationsService = {
  async createRelation(
    personalId: string,
    alunoId: string,
    professionalType: "PERSONAL" | "NUTRICIONISTA"
  ) {
    // 1. Validate aluno exists and is ALUNO
    const aluno = await prisma.user.findUnique({ where: { id: alunoId } });
    if (!aluno || aluno.role !== "ALUNO") {
      const err = new Error("Aluno não encontrado ou role inválida.");
      (err as any).statusCode = 404;
      throw err;
    }

    // 2. Prevent duplicate
    const existing = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (existing) {
      const err = new Error("Vínculo já existe.");
      (err as any).statusCode = 409;
      throw err;
    }

    // 3. Check limit — a contagem já era filtrada por personalId específico
    // (o campo guarda o id do profissional autenticado, seja Personal ou
    // Nutricionista), então o limite Freemium já é por profissional, não
    // global sobre o aluno. Auditado na Fase 11, nenhuma mudança necessária
    // aqui além de aceitar professionalType.
    const user = await prisma.user.findUnique({ where: { id: personalId } });
    if (!user) {
      const err = new Error("Profissional não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    const count = await relationsRepository.countByPersonal(personalId);
    if (count >= user.limiteAlunos) {
      const err = new Error("Limite de alunos atingido.");
      (err as any).statusCode = 403;
      throw err;
    }

    // 4. Create relation
    const relation = await relationsRepository.create(personalId, alunoId, professionalType);
    return relation;
  },

  async listRelations(personalId: string) {
    const relations = await relationsRepository.findAllByPersonal(personalId);
    const result: Array<{ id: string; email: string; avatarUrl: string | null; createdAt: Date }> = [];
    for (const rel of relations) {
      const aluno = await prisma.user.findUnique({ where: { id: rel.alunoId } });
      if (aluno) {
        result.push({ id: aluno.id, email: aluno.email, avatarUrl: aluno.avatarUrl, createdAt: rel.createdAt });
      }
    }
    return result;
  },
};
