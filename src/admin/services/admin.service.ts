import { adminRepository } from "../repository/admin.repository";

export const adminService = {
  async getOverview() {
    const [byRoleRaw, growthRaw, professionals, relationCounts] = await Promise.all([
      adminRepository.countUsersByRole(),
      adminRepository.newUsersLast30Days(),
      adminRepository.findProfessionalsWithLimite(),
      adminRepository.countRelationsGroupedByPersonal(),
    ]);

    const usersByRole: Record<string, number> = {};
    for (const row of byRoleRaw) {
      usersByRole[row.role] = row._count._all;
    }

    const newUsersByDay = growthRaw.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      count: Number(row.count),
    }));

    const relationCountByPersonal = new Map<string, number>();
    for (const row of relationCounts) {
      relationCountByPersonal.set(row.personalId, row._count._all);
    }

    const professionalsAtLimit = professionals.filter(
      (p) => (relationCountByPersonal.get(p.id) ?? 0) >= p.limiteAlunos
    ).length;

    return {
      usersByRole,
      newUsersByDay,
      professionalsAtFreemiumLimit: professionalsAtLimit,
      totalProfessionals: professionals.length,
    };
  },

  async listUsers(params: { role?: string; page: number; pageSize: number }) {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(Math.max(1, params.pageSize), 100);
    const { users, total } = await adminRepository.findUsersPage({
      role: params.role,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const alunoIds = users.filter((u) => u.role === "ALUNO").map((u) => u.id);
    const orphanIds = await adminRepository.findOrphanAlunoIds(alunoIds);

    const usersWithStatus = users.map((u) => ({
      ...u,
      isOrphanAluno: u.role === "ALUNO" ? orphanIds.has(u.id) : undefined,
    }));

    return { users: usersWithStatus, total, page, pageSize };
  },

  async listRecentLogins(take = 50) {
    const logs = await adminRepository.recentLogins(take);
    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await adminRepository.findUsersByIds(userIds);
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      email: emailById.get(log.userId) ?? "(usuário removido)",
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));
  },

  async getSupportSla() {
    const threads = await adminRepository.openThreadsOldestFirst();
    const now = Date.now();
    return threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      alunoId: t.alunoId,
      personalId: t.personalId,
      openedAt: t.createdAt,
      hoursOpen: Math.round(((now - t.createdAt.getTime()) / (1000 * 60 * 60)) * 10) / 10,
    }));
  },

  async listAccessLogs(take = 50) {
    return adminRepository.recentAccessLogs(take);
  },
};
