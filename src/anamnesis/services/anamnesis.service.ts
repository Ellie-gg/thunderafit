import { anamnesisRepository, AnamnesisInput } from "../repository/anamnesis.repository";

function notFound(message: string): never {
  const err = new Error(message);
  (err as any).statusCode = 404;
  throw err;
}

function conflict(message: string): never {
  const err = new Error(message);
  (err as any).statusCode = 409;
  throw err;
}

function forbidden(message: string): never {
  const err = new Error(message);
  (err as any).statusCode = 403;
  throw err;
}

export const anamnesisService = {
  async getOwn(alunoId: string) {
    return anamnesisRepository.findByAluno(alunoId);
  },

  async getForPersonal(personalId: string, alunoId: string) {
    const relation = await anamnesisRepository.findRelation(personalId, alunoId);
    if (!relation) {
      forbidden("Este aluno não está vinculado a você.");
    }
    const anamnesis = await anamnesisRepository.findByAluno(alunoId);
    if (!anamnesis) {
      notFound("Este aluno ainda não preencheu a anamnese.");
    }
    return anamnesis;
  },

  async create(alunoId: string, input: AnamnesisInput) {
    const existing = await anamnesisRepository.findByAluno(alunoId);
    if (existing) {
      conflict("Anamnese já existe. Use PUT para editar.");
    }
    return anamnesisRepository.create(alunoId, input);
  },

  async update(alunoId: string, input: AnamnesisInput) {
    const existing = await anamnesisRepository.findByAluno(alunoId);
    if (!existing) {
      notFound("Anamnese ainda não criada. Use POST primeiro.");
    }
    return anamnesisRepository.update(alunoId, input);
  },
};
