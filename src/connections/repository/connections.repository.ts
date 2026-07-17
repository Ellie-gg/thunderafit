import prisma from "../../lib/prisma";

type ProfessionalRole = "PERSONAL" | "NUTRICIONISTA";
type RequestStatus = "PENDENTE" | "ACEITA" | "RECUSADA";

const PUBLIC_PROFILE_SELECT = {
  id: true,
  email: true,
  role: true,
  location: true,
  bio: true,
} as const;

export const connectionsRepository = {
  /**
   * Busca profissionais disponíveis (opt-in) por role e localização (texto,
   * correspondência parcial case-insensitive). Retorna só o perfil público.
   */
  searchProfessionals(params: { role: ProfessionalRole; location?: string }) {
    return prisma.user.findMany({
      where: {
        role: params.role,
        availableForNewStudents: true,
        ...(params.location
          ? { location: { contains: params.location, mode: "insensitive" } }
          : {}),
      },
      select: PUBLIC_PROFILE_SELECT,
      orderBy: { createdAt: "asc" },
    });
  },

  getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, availableForNewStudents: true, location: true, bio: true },
    });
  },

  updateProfile(
    userId: string,
    data: { availableForNewStudents?: boolean; location?: string | null; bio?: string | null }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, role: true, availableForNewStudents: true, location: true, bio: true },
    });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findRequestById(id: string) {
    return prisma.connectionRequest.findUnique({ where: { id } });
  },

  findRequestByPair(alunoId: string, professionalId: string) {
    return prisma.connectionRequest.findUnique({
      where: { alunoId_professionalId: { alunoId, professionalId } },
    });
  },

  /** Cria ou reabre (re-solicitação após recusa) a solicitação, deixando PENDENTE. */
  upsertPendingRequest(alunoId: string, professionalId: string, professionalType: ProfessionalRole) {
    return prisma.connectionRequest.upsert({
      where: { alunoId_professionalId: { alunoId, professionalId } },
      update: { status: "PENDENTE", professionalType },
      create: { alunoId, professionalId, professionalType, status: "PENDENTE" },
    });
  },

  findRequestsForProfessional(professionalId: string) {
    return prisma.connectionRequest.findMany({
      where: { professionalId },
      orderBy: { createdAt: "desc" },
    });
  },

  findRequestsForAluno(alunoId: string) {
    return prisma.connectionRequest.findMany({
      where: { alunoId },
      orderBy: { createdAt: "desc" },
    });
  },

  setRequestStatus(id: string, status: RequestStatus) {
    return prisma.connectionRequest.update({ where: { id }, data: { status } });
  },

  usersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, location: true, bio: true },
    });
  },
};
