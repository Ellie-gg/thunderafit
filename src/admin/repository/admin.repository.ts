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

  /**
   * Fase 33: checagem de nome duplicado/similar em createExercise/updateExercise
   * só compara `.name` — não precisa da linha inteira do exercício (que
   * `listAllExercises` acima traz completa pra tela de listagem do admin).
   * Função separada em vez de adicionar `select` na acima, que é compartilhada.
   */
  async listAllExerciseNames() {
    return prisma.exercise.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  },

  async createExercise(data: {
    name: string;
    muscleGroup: string;
    equipment: string;
    description: string;
    difficultyLevel: "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
    isFeatured?: boolean;
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
      isFeatured?: boolean;
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

  /**
   * Fase 33: `updateUserRole` só lê `.role` do usuário-alvo antes de
   * atualizar (pra decidir se é o último ADMIN) — não usa mais nada do
   * resto da linha, então evita trazer o usuário inteiro (senha hash,
   * avatar, etc). Único chamador hoje é `adminService.updateUserRole`.
   */
  async findUserRoleById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
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

  // --- Fase 34.5: templates SELF ("Meu treino pessoal") ---
  // Curados pelo admin, sem Personal nenhum envolvido (origin: SELF,
  // personalId: null) — o aluno só aplica (copia), nunca edita. Queries
  // diretas via prisma aqui (não reaproveita workoutProgramsRepository do
  // domínio fitness) pra manter os domínios desacoplados, mesmo padrão já
  // usado no resto deste repository.

  async listSelfTemplates() {
    return prisma.workoutProgram.findMany({
      where: { origin: "SELF" },
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true } } },
    });
  },

  async createSelfTemplate(
    name: string,
    sessionScheme: "LETTER" | "WEEKDAY",
    category: "GERAL" | "HOME" | "PREMIUM" | "PRONTOS"
  ) {
    return prisma.workoutProgram.create({
      data: { name, origin: "SELF", personalId: null, isTemplate: true, sessionScheme, category },
    });
  },

  // Fase 52: banner do carrossel de "Meu Treino Pessoal" — `bannerImageUrl:
  // null` remove o banner (o card volta pro fallback estático só-com-nome).
  async updateSelfTemplateBanner(id: string, bannerImageUrl: string | null) {
    return prisma.workoutProgram.update({
      where: { id },
      data: { bannerImageUrl },
    });
  },

  async findSelfTemplateWithSessions(id: string) {
    return prisma.workoutProgram.findFirst({
      where: { id, origin: "SELF" },
      include: {
        workouts: {
          orderBy: { letter: "asc" },
          include: { exercises: { orderBy: { order: "asc" }, include: { exercise: true } } },
        },
      },
    });
  },

  async addSessionToSelfTemplate(programId: string, name: string, letter: string) {
    return prisma.workout.create({
      data: { programId, personalId: null, alunoId: null, name, letter },
    });
  },

  async addExerciseToSelfSession(
    workoutId: string,
    exerciseId: string,
    sets: number,
    repsRange: string,
    restSeconds: number,
    order: number,
    notes: string | null = null
  ) {
    return prisma.workoutExercise.create({
      data: { workoutId, exerciseId, sets, repsRange, restSeconds, order, notes },
    });
  },

  /** Mesma cascata manual do domínio fitness (nenhuma FK tem onDelete: Cascade). */
  async deleteSelfTemplate(programId: string) {
    const workouts = await prisma.workout.findMany({ where: { programId }, select: { id: true } });
    const workoutIds = workouts.map((w) => w.id);
    await prisma.$transaction(async (tx) => {
      await tx.workoutExercise.deleteMany({ where: { workoutId: { in: workoutIds } } });
      await tx.workout.deleteMany({ where: { programId } });
      await tx.workoutProgram.delete({ where: { id: programId } });
    });
  },
};
