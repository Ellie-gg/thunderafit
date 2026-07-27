import { adminRepository } from "../repository/admin.repository";
import { uploadExerciseMedia, uploadTemplateBanner } from "../../lib/storage";
// Reaproveita só as funções de ordenação/validação de esquema (puras, sem
// query) do domínio fitness — não importa o repository dele, pra manter os
// dois domínios desacoplados (mesmo padrão já usado no resto do projeto).
import { orderFor } from "../../fitness/repository/workout-programs.repository";
// Exceção pontual ao desacoplamento acima: o catálogo de exercícios agora é
// cache-backed (ver exercises.repository.ts) e este é o ÚNICO lugar que
// escreve em `Exercise` via HTTP — precisa invalidar o cache após cada
// mutação bem-sucedida, senão o catálogo fica stale por até 5min.
import { exercisesRepository } from "../../fitness/repository/exercises.repository";
import { exerciseTranslationsRepository } from "../../fitness/repository/exercise-translations.repository";
// Fase 55.2: mesmo motivo de exception ao desacoplamento acima — a tela de
// admin agora edita a tradução de nome de programa/sessão diretamente.
import { programTranslationsRepository } from "../../fitness/repository/program-translations.repository";
// Fase 58: toggle manual de Premium — reaproveita os mesmos limites de
// alunos por degrau já usados pelo billing real (PLUS = topo da escada).
import { PLUS_LIMITE_ALUNOS, FREE_LIMITE_ALUNOS } from "../../billing/stripe";

const VALID_SESSION_SCHEMES = ["LETTER", "WEEKDAY"] as const;
type AdminSessionScheme = (typeof VALID_SESSION_SCHEMES)[number];

// Fase 32: mídia de exercícios (vídeo/GIF nativo, sobe pro bucket GCS; link
// do YouTube não precisa de upload, só valida e salva o link). Nunca confia
// só no que o cliente diz que é o mediaType/formato — mesmo padrão de
// revalidação no backend já usado no avatar de usuário (Fase 30).
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;
const MAX_EXERCISE_MEDIA_DATA_URL_LENGTH = 6_000_000;
const VIDEO_DATA_URL_REGEX = /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/;
const GIF_DATA_URL_REGEX = /^data:image\/gif;base64,[A-Za-z0-9+/]+=*$/;

// Fase 52: banner de template SELF ("Meu Treino Pessoal") — imagem estática
// (não vídeo), mesmo teto de tamanho de mídia de exercício por simplicidade
// (o frontend já redimensiona/comprime no cliente antes de enviar, como o
// avatar — este limite é só a rede de segurança do backend).
const MAX_TEMPLATE_BANNER_DATA_URL_LENGTH = 6_000_000;
const TEMPLATE_BANNER_DATA_URL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

const VALID_SELF_TEMPLATE_CATEGORIES = ["GERAL", "HOME", "PREMIUM", "PRONTOS"] as const;
type AdminSelfTemplateCategory = (typeof VALID_SELF_TEMPLATE_CATEGORIES)[number];

// Fase 63: tags de filtro rápido (chips) — só editáveis em templates
// `origin: SELF` (qualquer categoria), nunca em PERSONAL_CATALOG.
const VALID_WORKOUT_TAGS = ["FEMININO", "HIPERTROFIA", "DEFINICAO", "EXPRESS"] as const;
type AdminWorkoutTag = (typeof VALID_WORKOUT_TAGS)[number];

// Fase 33: CRUD do catálogo de exercícios.
const VALID_DIFFICULTY_LEVELS = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"] as const;
type DifficultyLevel = (typeof VALID_DIFFICULTY_LEVELS)[number];
const VALID_ROLES = ["PERSONAL", "ALUNO", "NUTRICIONISTA", "ADMIN"] as const;
type UserRole = (typeof VALID_ROLES)[number];

// Nome IDÊNTICO já é barrado pelo @unique do schema — a checagem de
// similaridade aqui é só pra "parecido, mas diferente" (variação de
// espaço/acento/caixa, ou um erro de digitação de 1-2 caracteres), que não
// vira um bloqueio duro (podem ser exercícios legítimos diferentes), só um
// aviso com confirmação explícita.
function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

const SIMILAR_NAME_MAX_DISTANCE = 2;

function findSimilarExerciseNames(
  candidateName: string,
  existing: Array<{ id: string; name: string }>,
  excludeId?: string
): string[] {
  const normalizedCandidate = normalizeExerciseName(candidateName);
  const similar: string[] = [];
  for (const ex of existing) {
    if (ex.id === excludeId) continue;
    const normalizedExisting = normalizeExerciseName(ex.name);
    if (normalizedExisting === normalizedCandidate) {
      // Mesmo nome normalizado, mas grafia original diferente (acento/caixa/
      // espaço) — @unique do schema só barra o literal idêntico.
      similar.push(ex.name);
      continue;
    }
    if (levenshteinDistance(normalizedCandidate, normalizedExisting) <= SIMILAR_NAME_MAX_DISTANCE) {
      similar.push(ex.name);
    }
  }
  return similar;
}

function validateExerciseInput<
  T extends {
    name?: string;
    muscleGroup?: string;
    equipment?: string;
    description?: string;
    difficultyLevel?: string;
  },
>(
  input: T
): asserts input is T & {
  name: string;
  muscleGroup: string;
  equipment: string;
  description: string;
  difficultyLevel: DifficultyLevel;
} {
  const missing = ["name", "muscleGroup", "equipment", "description", "difficultyLevel"].filter(
    (field) => !(input as any)[field]
  );
  if (missing.length > 0) {
    const err = new Error(`Campo(s) obrigatório(s) ausente(s): ${missing.join(", ")}.`);
    (err as any).statusCode = 400;
    throw err;
  }
  if (!VALID_DIFFICULTY_LEVELS.includes(input.difficultyLevel as DifficultyLevel)) {
    const err = new Error("difficultyLevel inválido. Use INICIANTE, INTERMEDIARIO ou AVANCADO.");
    (err as any).statusCode = 400;
    throw err;
  }
}

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

  // Fase 33: trilha de ações administrativas sensíveis (hoje só mudança de
  // role) — tabela separada de AdminAccessLog (ver schema.prisma), exposta
  // junto na mesma tela pra manter a auditoria consolidada num único lugar.
  async listAuditLogs(take = 50) {
    return adminRepository.recentAuditLogs(take);
  },

  /**
   * Bugs potenciais considerados antes de escrever esta função:
   * - confiar no `mediaType` que o cliente manda sem validar o formato de
   *   verdade do `mediaDataUrl` — por isso cada branch tem seu próprio regex
   *   de formato, não só um length check genérico.
   * - checar existência do exercício DEPOIS de gastar tempo/banda fazendo
   *   upload pro bucket — a ordem é: busca o exercício, 404 se não existe, só
   *   ENTÃO valida e sobe a mídia.
   * - checar o tamanho ANTES de decodificar base64 (que já é ~37% maior que
   *   o arquivo original) — evita alocar memória por um payload
   *   artificialmente grande antes mesmo de rejeitá-lo.
   * - assumir formato válido antes de checar a vírgula — o regex de formato
   *   roda ANTES do `indexOf(",")`, então uma string malformada já é
   *   barrada antes de tentar separar header/payload.
   */
  async updateExerciseMedia(
    exerciseId: string,
    input: { mediaType?: string; mediaDataUrl?: string; youtubeUrl?: string }
  ) {
    const exercise = await adminRepository.findExerciseById(exerciseId);
    if (!exercise) {
      const err = new Error("Exercício não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    if (input.mediaType === "YOUTUBE") {
      if (!input.youtubeUrl || !YOUTUBE_URL_REGEX.test(input.youtubeUrl)) {
        const err = new Error("Link do YouTube inválido.");
        (err as any).statusCode = 400;
        throw err;
      }
      const updated = await adminRepository.updateExerciseMedia(exerciseId, input.youtubeUrl, "YOUTUBE");
      exercisesRepository.invalidateCache();
      exerciseTranslationsRepository.invalidateCache();
      return updated;
    }

    if (input.mediaType === "VIDEO" || input.mediaType === "GIF") {
      const dataUrl = input.mediaDataUrl;
      if (!dataUrl) {
        const err = new Error("Arquivo de mídia ausente.");
        (err as any).statusCode = 400;
        throw err;
      }
      if (dataUrl.length > MAX_EXERCISE_MEDIA_DATA_URL_LENGTH) {
        const err = new Error("Arquivo muito grande. Envie um vídeo/GIF de até ~4MB.");
        (err as any).statusCode = 400;
        throw err;
      }
      const isVideo = input.mediaType === "VIDEO";
      const regex = isVideo ? VIDEO_DATA_URL_REGEX : GIF_DATA_URL_REGEX;
      if (!regex.test(dataUrl)) {
        const err = new Error(
          isVideo ? "Formato inválido. Envie um vídeo MP4 ou WebM." : "Formato inválido. Envie um GIF."
        );
        (err as any).statusCode = 400;
        throw err;
      }

      const commaIndex = dataUrl.indexOf(",");
      const header = dataUrl.slice(0, commaIndex);
      const base64Data = dataUrl.slice(commaIndex + 1);
      const contentType = header.slice(5, header.indexOf(";"));
      const extension = isVideo ? (contentType.includes("webm") ? "webm" : "mp4") : "gif";
      const buffer = Buffer.from(base64Data, "base64");

      const url = await uploadExerciseMedia(buffer, contentType, extension);
      const updated = await adminRepository.updateExerciseMedia(exerciseId, url, input.mediaType as "VIDEO" | "GIF");
      exercisesRepository.invalidateCache();
      exerciseTranslationsRepository.invalidateCache();
      return updated;
    }

    const err = new Error("mediaType inválido. Use YOUTUBE, VIDEO ou GIF.");
    (err as any).statusCode = 400;
    throw err;
  },

  // --- Fase 33: CRUD do catálogo de exercícios ---

  async listExercisesForAdmin() {
    return adminRepository.listAllExercises();
  },

  /**
   * Bugs potenciais considerados antes de escrever esta função:
   * - checar nome EXATO duplicado antes do @unique estourar um erro cru do
   *   Prisma — mensagem clara em vez de um 500/erro genérico de constraint.
   * - rodar a checagem de similaridade sempre, mesmo sem confirmSimilarName,
   *   pra devolver a lista de nomes parecidos no aviso (o cliente precisa
   *   saber COM O QUE está parecido pra decidir se confirma).
   */
  async createExercise(input: {
    name?: string;
    muscleGroup?: string;
    equipment?: string;
    description?: string;
    difficultyLevel?: string;
    confirmSimilarName?: boolean;
    isFeatured?: boolean;
  }) {
    validateExerciseInput(input);

    const existing = await adminRepository.listAllExerciseNames();
    const exactMatch = existing.find(
      (ex) => normalizeExerciseName(ex.name) === normalizeExerciseName(input.name) && ex.name === input.name
    );
    if (exactMatch) {
      const err = new Error("Já existe um exercício com esse nome.");
      (err as any).statusCode = 409;
      throw err;
    }

    const similarNames = findSimilarExerciseNames(input.name, existing);
    if (similarNames.length > 0 && !input.confirmSimilarName) {
      return { warning: "similar_name" as const, similarNames };
    }

    const exercise = await adminRepository.createExercise({
      name: input.name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      description: input.description,
      difficultyLevel: input.difficultyLevel,
      isFeatured: input.isFeatured ?? false,
    });
    exercisesRepository.invalidateCache();
    exerciseTranslationsRepository.invalidateCache();
    return { exercise };
  },

  async updateExercise(
    exerciseId: string,
    input: {
      name?: string;
      muscleGroup?: string;
      equipment?: string;
      description?: string;
      difficultyLevel?: string;
      confirmSimilarName?: boolean;
      isFeatured?: boolean;
    }
  ) {
    const current = await adminRepository.findExerciseById(exerciseId);
    if (!current) {
      const err = new Error("Exercício não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    validateExerciseInput(input);

    const existing = await adminRepository.listAllExerciseNames();
    const exactMatch = existing.find(
      (ex) =>
        ex.id !== exerciseId &&
        normalizeExerciseName(ex.name) === normalizeExerciseName(input.name) &&
        ex.name === input.name
    );
    if (exactMatch) {
      const err = new Error("Já existe um exercício com esse nome.");
      (err as any).statusCode = 409;
      throw err;
    }

    const similarNames = findSimilarExerciseNames(input.name, existing, exerciseId);
    if (similarNames.length > 0 && !input.confirmSimilarName) {
      return { warning: "similar_name" as const, similarNames };
    }

    const exercise = await adminRepository.updateExercise(exerciseId, {
      name: input.name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      description: input.description,
      difficultyLevel: input.difficultyLevel,
      isFeatured: input.isFeatured ?? current.isFeatured,
    });
    exercisesRepository.invalidateCache();
    exerciseTranslationsRepository.invalidateCache();
    return { exercise };
  },

  /**
   * Bloqueia (409) em vez de deixar o FK constraint estourar cru — e,
   * principalmente, em vez de cascatear a exclusão: apagar um exercício em
   * uso apagaria prescrições/históricos de série de alunos de verdade sem
   * aviso nenhum. Sem `onDelete: Cascade` nesse relacionamento no schema é
   * proposital (mesmo raciocínio da Fase 31 pra programas/templates).
   */
  async deleteExercise(exerciseId: string) {
    const exercise = await adminRepository.findExerciseById(exerciseId);
    if (!exercise) {
      const err = new Error("Exercício não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    const usageCount = await adminRepository.countWorkoutItemsForExercise(exerciseId);
    if (usageCount > 0) {
      const err = new Error(
        `Este exercício está em uso em ${usageCount} prescrição(ões) e não pode ser excluído.`
      );
      (err as any).statusCode = 409;
      throw err;
    }

    await adminRepository.deleteExercise(exerciseId);
    exercisesRepository.invalidateCache();
    exerciseTranslationsRepository.invalidateCache();
    return { deleted: true };
  },

  // --- Fase 33: edição de role de usuário ---

  /**
   * Bugs potenciais considerados antes de escrever esta função:
   * - admin removendo a própria role de ADMIN (se acontecer sem querer,
   *   perde acesso ao próprio painel sem ninguém pra reverter via UI).
   * - remover o ÚLTIMO admin do sistema (mesmo que não seja o próprio
   *   admin logado) — travaria toda a área /nimbus até alguém rodar o seed
   *   manual de novo.
   * - confiar no role novo sem validar contra o enum de verdade.
   */
  async updateUserRole(adminId: string, targetUserId: string, newRole?: string) {
    if (!newRole || !VALID_ROLES.includes(newRole as UserRole)) {
      const err = new Error("role inválida. Use PERSONAL, ALUNO, NUTRICIONISTA ou ADMIN.");
      (err as any).statusCode = 400;
      throw err;
    }

    if (targetUserId === adminId) {
      const err = new Error("Você não pode alterar a própria role.");
      (err as any).statusCode = 400;
      throw err;
    }

    const target = await adminRepository.findUserRoleById(targetUserId);
    if (!target) {
      const err = new Error("Usuário não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    if (target.role === "ADMIN" && newRole !== "ADMIN") {
      const adminCount = await adminRepository.countUsersWithRole("ADMIN");
      if (adminCount <= 1) {
        const err = new Error("Não é possível remover o último administrador do sistema.");
        (err as any).statusCode = 400;
        throw err;
      }
    }

    const oldRole = target.role;
    const updated = await adminRepository.updateUserRole(targetUserId, newRole as UserRole);
    await adminRepository.createAuditLog(
      adminId,
      "ROLE_CHANGE",
      targetUserId,
      `${oldRole} -> ${newRole}`
    );
    return { user: updated };
  },

  /**
   * Fase 58: liga/desliga Premium manualmente — "Premium" significa uma
   * coisa diferente por role: pro ALUNO é o entitlement de
   * `alunoPremiumStatus`/`alunoPremiumExpiresAt` (mesmo modelo do teste
   * grátis, Fase 56); pro PERSONAL/NUTRICIONISTA é subir pro degrau PLUS de
   * `planoAssinatura` (o mais alto — não existe um degrau "Premium"
   * separado pra profissional, então reaproveita o topo da escada
   * existente). ADMIN não tem nenhum conceito de Premium — 400.
   *
   * Concessão manual do ALUNO usa uma data-limite bem distante (100 anos)
   * em vez de null, pra caber no mesmo contrato de
   * `alunoPremiumService.computeEntitlement` (que sempre compara
   * `alunoPremiumExpiresAt` contra `now()` — nunca confia só no status).
   */
  async setUserPremium(adminId: string, targetUserId: string, active: boolean) {
    const target = await adminRepository.findUserRoleById(targetUserId);
    if (!target) {
      const err = new Error("Usuário não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    let updated;
    if (target.role === "ALUNO") {
      const expiresAt = active ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) : null;
      updated = await adminRepository.setAlunoPremium(targetUserId, active, expiresAt);
    } else if (target.role === "PERSONAL" || target.role === "NUTRICIONISTA") {
      updated = active
        ? await adminRepository.setPersonalPlano(targetUserId, "PLUS", PLUS_LIMITE_ALUNOS)
        : await adminRepository.setPersonalPlano(targetUserId, "FREE", FREE_LIMITE_ALUNOS);
    } else {
      const err = new Error("Somente ALUNO ou PERSONAL/NUTRICIONISTA podem ter Premium.");
      (err as any).statusCode = 400;
      throw err;
    }

    await adminRepository.createAuditLog(
      adminId,
      "PREMIUM_TOGGLE",
      targetUserId,
      `${active ? "concedido" : "revogado"} (${target.role})`
    );
    return { user: updated };
  },

  // --- Fase 34.5: curadoria de templates SELF ("Meu treino pessoal") ---

  async listSelfTemplates(origin?: string) {
    const o = origin === "PERSONAL_CATALOG" ? "PERSONAL_CATALOG" : "SELF";
    return adminRepository.listSelfTemplates(o);
  },

  /**
   * Fase 55.2: além do template, devolve a tradução EN/ES (se já existir)
   * do próprio programa e de cada sessão, pra tela de admin pré-preencher
   * o formulário de edição em vez de sempre abrir em branco.
   */
  async getSelfTemplate(programId: string) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    const [programTranslations, workoutTranslationsByWorkout] = await Promise.all([
      programTranslationsRepository.findProgramTranslations(programId),
      Promise.all(
        template.workouts.map((w) => programTranslationsRepository.findWorkoutTranslations(w.id))
      ),
    ]);

    const programTranslationsMap = Object.fromEntries(programTranslations.map((t) => [t.locale, t.name]));
    // Fase 59: mapa separado da descrição traduzida — mantém `translations`
    // (nome) com a mesma forma de antes pra não quebrar quem já lê
    // `translations.EN` como string.
    const programDescriptionsMap = Object.fromEntries(
      programTranslations.filter((t) => t.description).map((t) => [t.locale, t.description as string])
    );
    return {
      ...template,
      translations: programTranslationsMap,
      translationDescriptions: programDescriptionsMap,
      workouts: template.workouts.map((w, index) => ({
        ...w,
        translations: Object.fromEntries(workoutTranslationsByWorkout[index].map((t) => [t.locale, t.name])),
      })),
    };
  },

  /**
   * Fase 55.2: edita o nome PT do template (fonte canônica, nunca tem linha
   * de tradução própria — mesmo contrato de Exercise/ExerciseTranslation) e,
   * se enviados, os nomes EN/ES via upsert (string vazia após trim = "não
   * mandou", não apaga uma tradução já existente).
   */
  async updateSelfTemplateNames(
    programId: string,
    input: {
      name?: string;
      nameEN?: string;
      nameES?: string;
      description?: string;
      descriptionEN?: string;
      descriptionES?: string;
    }
  ) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    if (!input.name?.trim()) {
      const err = new Error("Nome do template é obrigatório.");
      (err as any).statusCode = 400;
      throw err;
    }

    // Fase 59: descrição ("Foco") em PT é opcional de verdade (nem todo
    // template precisa de uma) — string vazia após trim vira `null` (limpa),
    // diferente de EN/ES abaixo, onde vazio significa "não mandou" (não
    // apaga tradução já salva por omissão, mesmo contrato do nome).
    const description = input.description === undefined ? undefined : input.description.trim() || null;
    await adminRepository.updateSelfTemplateName(programId, input.name.trim(), description);

    // Busca as traduções JÁ salvas pra preservar o `name` de uma quando só a
    // `description` está sendo enviada nesta chamada (senão sobrescreveria o
    // nome traduzido com o nome em PT por engano).
    const existingTranslations = await programTranslationsRepository.findProgramTranslations(programId);
    for (const locale of ["EN", "ES"] as const) {
      const nameInput = locale === "EN" ? input.nameEN : input.nameES;
      const descriptionInput = locale === "EN" ? input.descriptionEN : input.descriptionES;
      if (!nameInput?.trim() && !descriptionInput?.trim()) continue;
      const existing = existingTranslations.find((t) => t.locale === locale);
      const name = nameInput?.trim() || existing?.name || input.name.trim();
      await programTranslationsRepository.upsertProgramTranslation(
        programId,
        locale,
        name,
        descriptionInput?.trim() || undefined
      );
    }

    return this.getSelfTemplate(programId);
  },

  /** Fase 55.2: mesmo contrato acima, mas pro nome de uma sessão específica. */
  async updateSelfSessionNames(
    programId: string,
    sessionId: string,
    input: { name?: string; nameEN?: string; nameES?: string }
  ) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    const session = template.workouts.find((w) => w.id === sessionId);
    if (!session) {
      const err = new Error("Sessão não encontrada neste template.");
      (err as any).statusCode = 404;
      throw err;
    }
    if (!input.name?.trim()) {
      const err = new Error("Nome da sessão é obrigatório.");
      (err as any).statusCode = 400;
      throw err;
    }

    await adminRepository.updateSelfSessionName(sessionId, input.name.trim());
    if (input.nameEN?.trim()) {
      await programTranslationsRepository.upsertWorkoutTranslation(sessionId, "EN", input.nameEN.trim());
    }
    if (input.nameES?.trim()) {
      await programTranslationsRepository.upsertWorkoutTranslation(sessionId, "ES", input.nameES.trim());
    }

    return this.getSelfTemplate(programId);
  },

  async createSelfTemplate(name: string, sessionScheme?: string, category?: string, origin?: string) {
    if (!name?.trim()) {
      const err = new Error("Nome do template é obrigatório.");
      (err as any).statusCode = 400;
      throw err;
    }
    const scheme = (sessionScheme ?? "LETTER") as AdminSessionScheme;
    if (!VALID_SESSION_SCHEMES.includes(scheme)) {
      const err = new Error("sessionScheme deve ser LETTER ou WEEKDAY.");
      (err as any).statusCode = 400;
      throw err;
    }
    // Fase 62: "PERSONAL_CATALOG" (Templates Básico do Personal) não usa
    // `category` — o campo é semântica só de SELF (carrossel do aluno); fica
    // no default GERAL, ignorado no frontend pra esse origin.
    const o = origin === "PERSONAL_CATALOG" ? "PERSONAL_CATALOG" : "SELF";
    const cat = (category ?? "GERAL") as AdminSelfTemplateCategory;
    if (o === "SELF" && !VALID_SELF_TEMPLATE_CATEGORIES.includes(cat)) {
      const err = new Error("category deve ser GERAL, HOME ou PREMIUM.");
      (err as any).statusCode = 400;
      throw err;
    }
    return adminRepository.createSelfTemplate(name.trim(), scheme, cat, o);
  },

  /**
   * Fase 52: banner do carrossel de "Meu Treino Pessoal" (Treino em Casa /
   * Treinos Premium) — mesmo padrão de validação de updateExerciseMedia
   * (tamanho ANTES de decodificar base64, formato via regex ANTES de separar
   * header/payload, existência checada antes de gastar tempo com upload).
   * `bannerDataUrl: null` remove o banner (o card volta pro fallback
   * estático só-com-nome).
   */
  async uploadSelfTemplateBanner(programId: string, bannerDataUrl: string | null) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    if (bannerDataUrl === null) {
      return adminRepository.updateSelfTemplateBanner(programId, null);
    }

    if (bannerDataUrl.length > MAX_TEMPLATE_BANNER_DATA_URL_LENGTH) {
      const err = new Error("Imagem muito grande. Envie um banner de até ~4MB.");
      (err as any).statusCode = 400;
      throw err;
    }
    if (!TEMPLATE_BANNER_DATA_URL_REGEX.test(bannerDataUrl)) {
      const err = new Error("Formato inválido. Envie uma imagem PNG, JPEG ou WebP.");
      (err as any).statusCode = 400;
      throw err;
    }

    const commaIndex = bannerDataUrl.indexOf(",");
    const header = bannerDataUrl.slice(0, commaIndex);
    const base64Data = bannerDataUrl.slice(commaIndex + 1);
    const contentType = header.slice(5, header.indexOf(";"));
    const extension = contentType.split("/")[1];
    const buffer = Buffer.from(base64Data, "base64");

    const url = await uploadTemplateBanner(buffer, contentType, extension);
    return adminRepository.updateSelfTemplateBanner(programId, url);
  },

  /**
   * Fase 63: tags de filtro rápido (chips) do carrossel "Treinos Premium" —
   * só faz sentido em templates `origin: SELF` (curados no aluno); um
   * PERSONAL_CATALOG (Templates Básico) rejeita com 400 em vez de gravar
   * silenciosamente um campo que nunca é lido nesse origin.
   */
  async updateSelfTemplateTags(programId: string, tags: string[]) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    if (template.origin !== "SELF") {
      const err = new Error("Tags só podem ser definidas em templates do aluno (Meu treino pessoal).");
      (err as any).statusCode = 400;
      throw err;
    }
    const invalid = tags.filter((t) => !VALID_WORKOUT_TAGS.includes(t as AdminWorkoutTag));
    if (invalid.length > 0) {
      const err = new Error(`Tag(s) inválida(s): ${invalid.join(", ")}.`);
      (err as any).statusCode = 400;
      throw err;
    }
    return adminRepository.updateSelfTemplateTags(programId, tags as AdminWorkoutTag[]);
  },

  async addSessionToSelfTemplate(programId: string, name: string | undefined, letter: string) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    const validKeys = orderFor(template.sessionScheme);
    if (!validKeys.includes(letter)) {
      const err = new Error(
        template.sessionScheme === "WEEKDAY"
          ? "Sessão deve ser um dia da semana válido (SEGUNDA a DOMINGO)."
          : "Sessão deve ser uma letra de A a E."
      );
      (err as any).statusCode = 400;
      throw err;
    }
    if (template.workouts.length >= validKeys.length) {
      const err = new Error(`Um template pode ter no máximo ${validKeys.length} sessões.`);
      (err as any).statusCode = 400;
      throw err;
    }
    if (template.workouts.some((w) => w.letter === letter)) {
      const err = new Error(`A sessão ${letter} já existe neste template.`);
      (err as any).statusCode = 409;
      throw err;
    }
    return adminRepository.addSessionToSelfTemplate(
      programId,
      name?.trim() || `${template.name} — ${letter}`,
      letter
    );
  },

  async addExerciseToSelfSession(
    programId: string,
    sessionId: string,
    input: { exerciseId: string; sets: number; repsRange: string; restSeconds: number; order: number; notes?: string }
  ) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    const session = template.workouts.find((w) => w.id === sessionId);
    if (!session) {
      const err = new Error("Sessão não encontrada neste template.");
      (err as any).statusCode = 404;
      throw err;
    }
    return adminRepository.addExerciseToSelfSession(
      sessionId,
      input.exerciseId,
      input.sets,
      input.repsRange,
      input.restSeconds,
      input.order,
      input.notes?.trim() || null
    );
  },

  async deleteSelfTemplate(programId: string) {
    const template = await adminRepository.findSelfTemplateWithSessions(programId);
    if (!template) {
      const err = new Error("Template não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    await adminRepository.deleteSelfTemplate(programId);
  },
};
