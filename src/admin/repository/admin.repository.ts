import prisma from "../../lib/prisma";

export const adminRepository = {
  async countUsersByRole() {
    return prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  },

  /**
   * Novos usuários por dia nos últimos 30 dias. `$queryRaw` porque Prisma
   * não tem `groupBy` por bucket de data (só por coluna existente) — mesma
   * necessidade que motivou usar SQL cru pontualmente em outras fases de
   * agregação (ex: Progress, Fase 8).
   */
  async newUsersLast30Days(): Promise<Array<{ day: Date; count: bigint }>> {
    return prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS count
      FROM users
      WHERE "createdAt" >= now() - interval '30 days'
      GROUP BY day
      ORDER BY day ASC
    `;
  },

  async findProfessionalsWithLimite() {
    return prisma.user.findMany({
      where: { role: { in: ["PERSONAL", "NUTRICIONISTA"] } },
      select: { id: true, limiteAlunos: true },
    });
  },

  async countRelationsGroupedByPersonal() {
    return prisma.clientRelation.groupBy({
      by: ["personalId"],
      _count: { _all: true },
    });
  },

  async findUsersPage(params: { role?: string; skip: number; take: number }) {
    const where = params.role ? { role: params.role as any } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          email: true,
          role: true,
          planoAssinatura: true,
          limiteAlunos: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total };
  },

  /** ids de ALUNO que não têm nenhum ClientRelation (nem Personal, nem Nutricionista). */
  async findOrphanAlunoIds(alunoIds: string[]): Promise<Set<string>> {
    if (alunoIds.length === 0) return new Set();
    const linked = await prisma.clientRelation.findMany({
      where: { alunoId: { in: alunoIds } },
      select: { alunoId: true },
      distinct: ["alunoId"],
    });
    const linkedSet = new Set(linked.map((l) => l.alunoId));
    return new Set(alunoIds.filter((id) => !linkedSet.has(id)));
  },

  // Sem relação declarada no schema entre LoginLog e User — o e-mail de
  // cada login é resolvido à parte via findUsersByIds.
  async recentLogins(take: number) {
    return prisma.loginLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  async findUsersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, role: true },
    });
  },

  async openThreadsOldestFirst() {
    return prisma.supportThread.findMany({
      where: { status: "ABERTO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, subject: true, alunoId: true, personalId: true, createdAt: true },
    });
  },

  async createAccessLog(adminId: string, resourceType: string, alunoId: string) {
    return prisma.adminAccessLog.create({
      data: { adminId, resourceType, alunoId },
    });
  },

  async recentAccessLogs(take: number) {
    return prisma.adminAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  async findExerciseById(id: string) {
    return prisma.exercise.findUnique({ where: { id } });
  },

  async updateExerciseMedia(id: string, mediaUrl: string, mediaType: "YOUTUBE" | "VIDEO" | "GIF") {
    return prisma.exercise.update({
      where: { id },
      data: { mediaUrl, mediaType },
    });
  },

  // --- Fase 33: CRUD do catálogo de exercícios ---

  async findExerciseByName(name: string) {
    return prisma.exercise.findUnique({ where: { name } });
  },

  async listAllExercises() {
    return prisma.exercise.findMany({ orderBy: { name: "asc" } });
  },

  async createExercise(data: {
    name: string;
    muscleGroup: string;
    equipment: string;
    description: string;
    difficultyLevel: "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
  }) {
    return prisma.exercise.create({ data });
  },

  async updateExercise(
    id: string,
    data: {
      name: string;
      muscleGroup: string;
      equipment: string;
      description: string;
      difficultyLevel: "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
    }
  ) {
    return prisma.exercise.update({ where: { id }, data });
  },

  async countWorkoutItemsForExercise(exerciseId: string) {
    return prisma.workoutExercise.count({ where: { exerciseId } });
  },

  async deleteExercise(id: string) {
    return prisma.exercise.delete({ where: { id } });
  },

  // --- Fase 33: edição de role de usuário ---

  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async countUsersWithRole(role: "PERSONAL" | "ALUNO" | "NUTRICIONISTA" | "ADMIN") {
    return prisma.user.count({ where: { role } });
  },

  async updateUserRole(id: string, role: "PERSONAL" | "ALUNO" | "NUTRICIONISTA" | "ADMIN") {
    return prisma.user.update({ where: { id }, data: { role } });
  },

  async createAuditLog(adminId: string, action: string, targetUserId: string, details: string) {
    return prisma.adminAuditLog.create({
      data: { adminId, action, targetUserId, details },
    });
  },

  async recentAuditLogs(take: number) {
    return prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
    });
  },
};
