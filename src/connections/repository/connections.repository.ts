import { Specialty } from "@prisma/client";
import prisma from "../../lib/prisma";

type ProfessionalRole = "PERSONAL" | "NUTRICIONISTA";
type RequestStatus = "PENDENTE" | "ACEITA" | "RECUSADA";

const PUBLIC_PROFILE_SELECT = {
  id: true,
  email: true,
  role: true,
  bio: true,
  city: true,
  state: true,
  specialties: true,
  avatarUrl: true,
  planoAssinatura: true,
} as const;

const MY_PROFILE_SELECT = {
  id: true,
  email: true,
  role: true,
  availableForNewStudents: true,
  bio: true,
  city: true,
  state: true,
  specialties: true,
  avatarUrl: true,
  planoAssinatura: true,
} as const;

export const connectionsRepository = {
  /**
   * Busca profissionais disponíveis (opt-in) por role + cidade/UF/
   * especialidades. Fase 75: cidade/UF viraram estruturados — igualdade
   * exata (case-insensitive na cidade), não mais `contains` por texto livre.
   * Retorna só o perfil público.
   *
   * `planoAssinatura: { not: "FREE" }` é defesa em profundidade: o degrau
   * Free nunca pode ATIVAR `availableForNewStudents` (gate em
   * `updateMyProfile`) nem SEGUIR aparecendo depois de um downgrade
   * (`applyFreePlan` já desliga o campo) — mas filtrar aqui também garante
   * que nenhuma linha antiga/inconsistente vaze pro diretório, sem depender
   * só desses dois outros pontos estarem corretos.
   *
   * PLUS aparece primeiro (destaque/prioridade), depois BASE, ordenado por
   * antiguidade dentro do mesmo degrau — `orderBy` num enum usa a ordem de
   * DECLARAÇÃO no schema (FREE, BASE, PLUS), então `desc` põe PLUS na frente.
   */
  searchProfessionals(params: {
    role: ProfessionalRole;
    city?: string;
    state?: string;
    specialties?: Specialty[];
  }) {
    return prisma.user.findMany({
      where: {
        role: params.role,
        availableForNewStudents: true,
        planoAssinatura: { not: "FREE" },
        ...(params.city ? { city: { equals: params.city, mode: "insensitive" } } : {}),
        ...(params.state ? { state: params.state } : {}),
        ...(params.specialties?.length ? { specialties: { hasSome: params.specialties } } : {}),
      },
      select: PUBLIC_PROFILE_SELECT,
      orderBy: [{ planoAssinatura: "desc" }, { createdAt: "asc" }],
    });
  },

  getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: MY_PROFILE_SELECT,
    });
  },

  updateProfile(
    userId: string,
    data: {
      availableForNewStudents?: boolean;
      bio?: string | null;
      city?: string | null;
      state?: string | null;
      specialties?: Specialty[];
    }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: MY_PROFILE_SELECT,
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
      select: { id: true, email: true, city: true, state: true, bio: true, avatarUrl: true },
    });
  },

  /** Fase 76: mensagens de uma conversa (aluno↔profissional) presa a uma ConnectionRequest. */
  createMessage(connectionRequestId: string, senderId: string, body: string) {
    return prisma.connectionMessage.create({
      data: { connectionRequestId, senderId, body },
    });
  },

  listMessages(connectionRequestId: string) {
    return prisma.connectionMessage.findMany({
      where: { connectionRequestId },
      orderBy: { createdAt: "asc" },
    });
  },
};
