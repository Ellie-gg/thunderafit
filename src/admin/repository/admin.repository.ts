import prisma from "../../lib/prisma";
import { WorkoutTag } from "@prisma/client";

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
          // Fase 80: nome + foto — a lista mostrava só o e-mail, sem cara
          // nenhuma pra identificar quem é quem.
          name: true,
          avatarUrl: true,
          role: true,
          planoAssinatura: true,
          limiteAlunos: true,
          // Fase 58: pra tela de admin mostrar o estado Premium vigente do
          // ALUNO (setUserPremium abaixo escreve nestes dois campos).
          alunoPremiumStatus: true,
          alunoPremiumExpiresAt: true,
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

  /**
   * Fase 80 — remoção definitiva de usuário. Nenhuma das tabelas abaixo tem
   * FK de verdade pra `User` (colunas soltas, sem `@relation` — só
   * `WorkoutExercise`/`SetLog`/`DietMeal`/`DietFood`/`WorkoutProgramTranslation`/
   * `WorkoutTranslation`/`ConnectionMessage`/`SupportMessage` têm FK real, e
   * essas apontam pra outra tabela do próprio domínio, não pra `User`
   * diretamente) — apagar a linha de `User` sozinha NUNCA falharia por
   * violação de FK, mas deixaria lixo órfão espalhado por quase todo
   * domínio. Por isso o cascade manual abaixo, mesmo padrão já usado em
   * `deleteSelfTemplate` (filhos antes dos pais, tudo numa `$transaction`).
   *
   * Duas categorias de dado tratadas de formas diferentes de propósito:
   * - Dado que só faz sentido COM o usuário (Anamnesis, Notification,
   *   LoginLog, ContactMessage, e qualquer relação de 2 lados onde este
   *   usuário é um dos lados — ClientRelation, ConnectionRequest+Message,
   *   SupportThread+Message): apagado.
   * - `WorkoutProgram`/`Workout` que este usuário criou (`personalId`) mas
   *   que pertencem a OUTRO aluno que continua existindo: `personalId` vira
   *   `null` em vez de apagar — apagar destruiria o histórico de treino de
   *   um aluno que não tem nada a ver com esta remoção. Só é apagado de
   *   verdade quando o PRÓPRIO `alunoId` do programa é o usuário removido.
   * - `AdminAccessLog`/`AdminAuditLog` NUNCA são tocados — são trilha de
   *   auditoria; a referência ficar órfã (sem FK, então sem erro nenhum) é
   *   aceitável e desejável (quer dizer "admin X apagou o usuário Y" continua
   *   legível mesmo depois de Y não existir mais).
   * - `DietPlan` não tem `nutricionistaId` nullable no schema — um plano
   *   cujo nutricionista foi removido é apagado por completo (perde o plano
   *   do aluno associado também), aceito como trade-off explícito desta
   *   fase em vez de migração nova só pra isso.
   */
  async deleteUser(userId: string) {
    // Timeout maior que o default (5s) — um Personal com muitos alunos/
    // programas pode ter bastante coisa pra apagar em cascata manual.
    await prisma.$transaction(async (tx) => {
      // --- Workout/WorkoutProgram: aluno-owned é apagado, personal-owned (de outro aluno) só perde o dono ---
      const ownedPrograms = await tx.workoutProgram.findMany({
        where: { alunoId: userId },
        select: { id: true },
      });
      const ownedProgramIds = ownedPrograms.map((p) => p.id);
      if (ownedProgramIds.length > 0) {
        const ownedWorkouts = await tx.workout.findMany({
          where: { programId: { in: ownedProgramIds } },
          select: { id: true },
        });
        const ownedWorkoutIds = ownedWorkouts.map((w) => w.id);
        const ownedWorkoutExercises = await tx.workoutExercise.findMany({
          where: { workoutId: { in: ownedWorkoutIds } },
          select: { id: true },
        });
        const ownedWorkoutExerciseIds = ownedWorkoutExercises.map((we) => we.id);
        await tx.setLog.deleteMany({ where: { workoutExerciseId: { in: ownedWorkoutExerciseIds } } });
        await tx.workoutExercise.deleteMany({ where: { workoutId: { in: ownedWorkoutIds } } });
        // Workout/WorkoutProgram translations têm onDelete: Cascade — somem sozinhas.
        await tx.workout.deleteMany({ where: { programId: { in: ownedProgramIds } } });
        await tx.workoutProgram.deleteMany({ where: { id: { in: ownedProgramIds } } });
      }

      const personalPrograms = await tx.workoutProgram.findMany({
        where: { personalId: userId },
        select: { id: true, alunoId: true },
      });
      const toOrphanProgramIds = personalPrograms
        .filter((p) => p.alunoId !== userId)
        .map((p) => p.id);
      if (toOrphanProgramIds.length > 0) {
        await tx.workoutProgram.updateMany({
          where: { id: { in: toOrphanProgramIds } },
          data: { personalId: null },
        });
        await tx.workout.updateMany({
          where: { programId: { in: toOrphanProgramIds } },
          data: { personalId: null },
        });
      }

      // --- DietPlan (qualquer lado) + meals + foods ---
      const dietPlans = await tx.dietPlan.findMany({
        where: { OR: [{ nutricionistaId: userId }, { alunoId: userId }] },
        select: { id: true },
      });
      const dietPlanIds = dietPlans.map((d) => d.id);
      if (dietPlanIds.length > 0) {
        const dietMeals = await tx.dietMeal.findMany({
          where: { dietPlanId: { in: dietPlanIds } },
          select: { id: true },
        });
        const dietMealIds = dietMeals.map((m) => m.id);
        await tx.dietFood.deleteMany({ where: { dietMealId: { in: dietMealIds } } });
        await tx.dietMeal.deleteMany({ where: { dietPlanId: { in: dietPlanIds } } });
        await tx.dietPlan.deleteMany({ where: { id: { in: dietPlanIds } } });
      }

      // --- Anamnesis (só o próprio aluno tem) ---
      await tx.anamnesis.deleteMany({ where: { alunoId: userId } });

      // --- Dúvidas (SupportThread/SupportMessage), qualquer lado ---
      const threads = await tx.supportThread.findMany({
        where: { OR: [{ alunoId: userId }, { personalId: userId }] },
        select: { id: true },
      });
      const threadIds = threads.map((t) => t.id);
      if (threadIds.length > 0) {
        await tx.supportMessage.deleteMany({ where: { threadId: { in: threadIds } } });
        await tx.supportThread.deleteMany({ where: { id: { in: threadIds } } });
      }

      // --- Conversa de contato (ConnectionRequest/ConnectionMessage), qualquer lado ---
      const requests = await tx.connectionRequest.findMany({
        where: { OR: [{ alunoId: userId }, { professionalId: userId }] },
        select: { id: true },
      });
      const requestIds = requests.map((r) => r.id);
      if (requestIds.length > 0) {
        await tx.connectionMessage.deleteMany({ where: { connectionRequestId: { in: requestIds } } });
        await tx.connectionRequest.deleteMany({ where: { id: { in: requestIds } } });
      }

      // --- Vínculo Personal/Nutricionista <-> Aluno, qualquer lado ---
      await tx.clientRelation.deleteMany({
        where: { OR: [{ personalId: userId }, { alunoId: userId }] },
      });

      // --- Dados só do próprio usuário ---
      await tx.notification.deleteMany({ where: { userId } });
      await tx.loginLog.deleteMany({ where: { userId } });
      await tx.contactMessage.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });
    }, { timeout: 20000 });
  },

  /**
   * Fase 58: concessão/revogação MANUAL de Premium pelo admin — exceção
   * documentada à regra de "só o webhook do Stripe escreve planoAssinatura"
   * (ver src/billing/AGENTS.md), pra suporte/cortesia sem depender de
   * cobrança real. `expiresAt: null` ao revogar não deixa `alunoTrialUsedAt`
   * de lado — quem já usou o teste continua sem direito a um novo, mesmo
   * após ganhar e perder um Premium concedido manualmente.
   */
  async setAlunoPremium(userId: string, active: boolean, expiresAt: Date | null) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        alunoPremiumStatus: active ? "ACTIVE" : "NONE",
        alunoPremiumExpiresAt: expiresAt,
      },
    });
  },

  async setPersonalPlano(userId: string, plano: "FREE" | "PLUS", limiteAlunos: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { planoAssinatura: plano, limiteAlunos },
    });
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

  // Fase 62: `origin` agora é parametrizável — "PERSONAL_CATALOG" é o
  // catálogo "Templates Básico" oferecido ao Personal, curado nesta MESMA
  // tela de admin, sem nenhuma rota nova ("Templates Premium" do Personal
  // não usa este catálogo: reaproveita os SELF/PREMIUM já existentes).
  async listSelfTemplates(origin: "SELF" | "PERSONAL_CATALOG" = "SELF") {
    return prisma.workoutProgram.findMany({
      where: { origin },
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true } } },
    });
  },

  async createSelfTemplate(
    name: string,
    sessionScheme: "LETTER" | "WEEKDAY",
    category: "GERAL" | "HOME" | "PREMIUM" | "PRONTOS",
    origin: "SELF" | "PERSONAL_CATALOG" = "SELF"
  ) {
    return prisma.workoutProgram.create({
      data: { name, origin, personalId: null, isTemplate: true, sessionScheme, category },
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

  // Fase 63: tags de filtro rápido (chips) — sempre substitui a lista
  // inteira (nunca soma/subtrai uma tag por vez), mesmo contrato simples de
  // "manda o estado final" já usado pelo formulário de admin.
  async updateSelfTemplateTags(id: string, tags: WorkoutTag[]) {
    return prisma.workoutProgram.update({
      where: { id },
      data: { tags },
    });
  },

  async findSelfTemplateWithSessions(id: string) {
    // Fase 62: aceita as 2 origins curadas pelo admin nesta tela (SELF e
    // PERSONAL_CATALOG) — todo o resto do CRUD (nome/tradução/banner/
    // sessões/exercícios/delete) passa por aqui primeiro pra confirmar
    // existência, então os dois catálogos ganham o CRUD completo de graça.
    return prisma.workoutProgram.findFirst({
      where: { id, origin: { in: ["SELF", "PERSONAL_CATALOG"] } },
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

  // Fase 55.2: edição do nome (PT) do template/sessão — a tradução EN/ES em
  // si é responsabilidade do programTranslationsRepository (domínio fitness,
  // já reaproveitado aqui mesmo padrão de exerciseTranslationsRepository).
  // Fase 59: `description` (Foco) é opcional — `undefined` = "não mandou,
  // não mexe"; string vazia é tratada pelo service como "limpar" (vira null).
  async updateSelfTemplateName(programId: string, name: string, description?: string | null) {
    return prisma.workoutProgram.update({
      where: { id: programId },
      data: description === undefined ? { name } : { name, description },
    });
  },

  async updateSelfSessionName(workoutId: string, name: string) {
    return prisma.workout.update({ where: { id: workoutId }, data: { name } });
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
