import prisma from "../../lib/prisma";
import { WorkoutTag } from "@prisma/client";
import { deleteUserCascade } from "../../lib/user-deletion";

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

  /**
   * Perf (triagem 2026-07-29, item de alto impacto): antes trazia TODOS os
   * profissionais (`findMany`) + o `groupBy` inteiro de `ClientRelation`
   * pra Node, e comparava linha a linha em memória — cresce com o tamanho
   * TOTAL da plataforma, não por-tenant. Uma única agregação no Postgres
   * (LEFT JOIN + COUNT FILTER) devolve só os 2 números finais; nenhuma
   * linha de usuário/vínculo atravessa a rede.
   */
  async countProfessionalsAtFreemiumLimit(): Promise<{ atLimit: number; total: number }> {
    const rows = await prisma.$queryRaw<Array<{ at_limit: bigint; total: bigint }>>`
      SELECT
        count(*) FILTER (WHERE COALESCE(rel.cnt, 0) >= u."limiteAlunos") AS at_limit,
        count(*) AS total
      FROM users u
      LEFT JOIN (
        SELECT "personalId", count(*)::int AS cnt
        FROM "ClientRelation"
        GROUP BY "personalId"
      ) rel ON rel."personalId" = u.id
      WHERE u.role IN ('PERSONAL', 'NUTRICIONISTA')
    `;
    return { atLimit: Number(rows[0]?.at_limit ?? 0), total: Number(rows[0]?.total ?? 0) };
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
          // Fase 90: prazo de uma concessão manual (null = permanente/FREE).
          planoAssinaturaExpiresAt: true,
          // Fase 58: pra tela de admin mostrar o estado Premium vigente do
          // ALUNO (setUserPremium abaixo escreve nestes dois campos).
          alunoPremiumStatus: true,
          alunoPremiumExpiresAt: true,
          // Fase 90: pra tela de admin mostrar/editar a confirmação de e-mail.
          emailVerifiedAt: true,
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

  /**
   * Fase 84: `mediaUrl`/`mediaType` ficam `undefined` (não `mediaUrl: ""`)
   * quando o admin só está atualizando o `youtubeSupplementUrl` de um
   * exercício VIDEO/GIF já existente, sem subir um arquivo novo — o Prisma
   * ignora chaves `undefined` no `data`, então o campo simplesmente não é
   * tocado. `youtubeSupplementUrl: null` (explícito) limpa o campo;
   * `undefined` deixa como estava.
   */
  async updateExerciseMedia(
    id: string,
    data: {
      mediaUrl?: string;
      mediaType?: "YOUTUBE" | "VIDEO" | "GIF";
      youtubeSupplementUrl?: string | null;
    }
  ) {
    return prisma.exercise.update({
      where: { id },
      data,
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
   * C5 (auditoria 2026-07-31): `updateUserRole` + `createAuditLog` eram 2
   * escritas INDEPENDENTES no service — se a mudança de role comitasse mas o
   * log de auditoria falhasse (timeout, indisponibilidade momentânea), o
   * usuário já tinha sido promovido/rebaixado e o admin via um 500 achando
   * que não tinha funcionado, sem NENHUM registro da mudança em
   * `AdminAuditLog` — exatamente o cenário que o log deveria cobrir contra
   * escalada de privilégio sem rastro. `$transaction` garante as duas juntas
   * ou nenhuma.
   */
  async updateUserRoleWithAuditLog(
    id: string,
    role: "PERSONAL" | "ALUNO" | "NUTRICIONISTA" | "ADMIN",
    adminId: string,
    details: string
  ) {
    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { role } }),
      prisma.adminAuditLog.create({
        data: { adminId, action: "ROLE_CHANGE", targetUserId: id, details },
      }),
    ]);
    return updated;
  },

  /**
   * Fase 80 — remoção definitiva de usuário pelo admin. O cascade em si
   * (Fase 81: extraído pra ser reaproveitado pelo self-delete também) vive
   * em `src/lib/user-deletion.ts` — ver o comentário lá pra rationale
   * completo de quais tabelas são apagadas vs. só desvinculadas.
   */
  async deleteUser(userId: string) {
    await deleteUserCascade(userId);
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

  /**
   * Fase 90: ganhou `tier` BASE (antes só FREE/PLUS) e `expiresAt` opcional
   * — concessão manual com prazo ("brinde"), revertida sozinha por
   * `revertExpiredPersonalPlan` (ver src/lib/plan-expiry.ts) quando vence.
   * `expiresAt: null` (default) continua o comportamento antigo: permanente,
   * igual uma concessão real via Stripe.
   */
  async setPersonalPlano(
    userId: string,
    plano: "FREE" | "BASE" | "PLUS",
    limiteAlunos: number,
    expiresAt: Date | null = null
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        planoAssinatura: plano,
        limiteAlunos,
        planoAssinaturaExpiresAt: expiresAt,
        // B7 (auditoria 2026-07-31): `billingRepository.applyFreePlan` (o
        // downgrade via webhook) desliga isto de propósito ao cair pra
        // FREE — este caminho (revogação manual do admin) não desligava,
        // deixando o toggle "ligado" na tela do Personal mesmo já invisível
        // no diretório de verdade (o filtro de `connections.repository.ts`
        // já exclui FREE) — estado inconsistente, não vazamento.
        ...(plano === "FREE" ? { availableForNewStudents: false } : {}),
      },
    });
  },

  /**
   * Fase 90 — confirmação de e-mail manual pelo admin (suporte: e-mail nunca
   * chegou, usuário trocou de conta, etc.), mesmo bypass já documentado pra
   * Premium/plano. Limpa também o token pendente (mesmo shape de
   * `authRepository.markEmailVerified`, que cobre o fluxo real por link).
   */
  async markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
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
