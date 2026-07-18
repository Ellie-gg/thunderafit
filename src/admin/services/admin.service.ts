import { adminRepository } from "../repository/admin.repository";
import { uploadExerciseMedia } from "../../lib/storage";

// Fase 32: mídia de exercícios (vídeo/GIF nativo, sobe pro bucket GCS; link
// do YouTube não precisa de upload, só valida e salva o link). Nunca confia
// só no que o cliente diz que é o mediaType/formato — mesmo padrão de
// revalidação no backend já usado no avatar de usuário (Fase 30).
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;
const MAX_EXERCISE_MEDIA_DATA_URL_LENGTH = 6_000_000;
const VIDEO_DATA_URL_REGEX = /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/;
const GIF_DATA_URL_REGEX = /^data:image\/gif;base64,[A-Za-z0-9+/]+=*$/;

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
      return adminRepository.updateExerciseMedia(exerciseId, input.youtubeUrl, "YOUTUBE");
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
      return adminRepository.updateExerciseMedia(exerciseId, url, input.mediaType as "VIDEO" | "GIF");
    }

    const err = new Error("mediaType inválido. Use YOUTUBE, VIDEO ou GIF.");
    (err as any).statusCode = 400;
    throw err;
  },
};
