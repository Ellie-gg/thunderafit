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

  /**
   * C3 (auditoria 2026-07-31): usado quando um `ClientRelation` é removido
   * (`relationsService.removeRelation`, fitness) — se existia uma
   * `ConnectionRequest` ACEITA daquele par, ela precisa sumir junto, senão
   * `findRequestByPair` continua achando `status: "ACEITA"` pra sempre e
   * `createRequest` recusa qualquer nova tentativa de solicitação com 409
   * "Você já está vinculado a este profissional", mesmo sem vínculo nenhum
   * existir mais — o aluno nunca mais conseguiria pedir pra se conectar de
   * novo com aquele profissional. `deleteMany` (não `delete`) porque o par
   * pode não ter `ConnectionRequest` nenhuma (vínculo criado direto por
   * e-mail/convite, nunca passou pelo diretório) — nesse caso é no-op.
   */
  async deleteRequestByPair(alunoId: string, professionalId: string) {
    // `ConnectionMessage` referencia `ConnectionRequest` sem cascade no
    // schema — precisa apagar as mensagens primeiro, senão a FK rejeita o
    // delete da solicitação (achado ao testar C3: toda solicitação aceita
    // tem pelo menos 1 mensagem, a que o aluno mandou ao pedir o vínculo).
    const existing = await prisma.connectionRequest.findUnique({
      where: { alunoId_professionalId: { alunoId, professionalId } },
    });
    if (!existing) return;
    await prisma.connectionMessage.deleteMany({ where: { connectionRequestId: existing.id } });
    await prisma.connectionRequest.delete({ where: { id: existing.id } });
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
