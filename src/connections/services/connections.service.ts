import { Specialty } from "@prisma/client";
import { connectionsRepository } from "../repository/connections.repository";
import { relationsService } from "../../fitness/services/relations.service";
import { notificationsService } from "../../notifications/services/notifications.service";
import { isValidBrState, isValidSpecialty } from "../constants";
import { revertExpiredPersonalPlan } from "../../lib/plan-expiry";

type ProfessionalRole = "PERSONAL" | "NUTRICIONISTA";

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export const connectionsService = {
  async searchProfessionals(
    params: { city?: string; state?: string; specialties?: string[] },
    role: ProfessionalRole
  ) {
    if (params.state && !isValidBrState(params.state)) {
      throw httpError("UF inválida.", 400);
    }
    const specialties = params.specialties?.filter(isValidSpecialty) as Specialty[] | undefined;
    return connectionsRepository.searchProfessionals({
      role,
      city: params.city?.trim() || undefined,
      state: params.state || undefined,
      specialties: specialties?.length ? specialties : undefined,
    });
  },

  async getMyProfile(userId: string) {
    const profile = await connectionsRepository.getProfile(userId);
    if (!profile) throw httpError("Usuário não encontrado.", 404);
    return profile;
  },

  /**
   * Fase 75: `city`/`state` podem ser salvos por QUALQUER papel (é assim que
   * o aluno guarda a cidade usada na busca de profissionais) — só
   * `availableForNewStudents`/`bio`/`specialties` continuam exclusivos de
   * papéis profissionais (perfil público de verdade).
   */
  async updateMyProfile(
    userId: string,
    role: string,
    data: {
      availableForNewStudents?: boolean;
      bio?: string | null;
      city?: string | null;
      state?: string | null;
      specialties?: string[];
    }
  ) {
    const isProfessional = role === "PERSONAL" || role === "NUTRICIONISTA";
    if (
      (data.availableForNewStudents !== undefined || data.bio !== undefined || data.specialties !== undefined) &&
      !isProfessional
    ) {
      throw httpError("Apenas profissionais têm perfil público.", 403);
    }

    const clean: {
      availableForNewStudents?: boolean;
      bio?: string | null;
      city?: string | null;
      state?: string | null;
      specialties?: Specialty[];
    } = {};

    if (typeof data.availableForNewStudents === "boolean") {
      // Gate de degrau: Free não pode ATIVAR disponibilidade no diretório
      // (Base+ ganhou esse acesso nesta fase). Desligar continua sempre
      // permitido em qualquer degrau.
      if (data.availableForNewStudents) {
        // M2 (auditoria 2026-08-06): passa por `revertExpiredPersonalPlan`
        // ANTES de decidir. Este era o único ponto de decisão de autorização
        // do backend que lia `planoAssinatura` cru do banco — e como nada
        // reescreve a linha quando uma cortesia do admin vence (a reversão é
        // materializada sob demanda, por design), um Personal com BASE/PLUS
        // vencido conseguia RELIGAR a presença no diretório público e ainda
        // ser rankeado acima dos FREE por `searchProfessionals`. O B7/C2 da
        // auditoria anterior fechou só a direção "desligar"; esta é a
        // direção "religar". Mesma classe do bug da Fase 117 (derivar acesso
        // do estado armazenado em vez da data de expiração).
        const raw = await connectionsRepository.findUserById(userId);
        const user = raw ? await revertExpiredPersonalPlan(raw) : null;
        if (user?.planoAssinatura === "FREE") {
          throw httpError(
            "Disponibilidade no diretório é um recurso dos planos Base e Plus. Faça upgrade para ativar.",
            403
          );
        }
      }
      clean.availableForNewStudents = data.availableForNewStudents;
    }
    if (data.bio !== undefined) clean.bio = data.bio?.toString().trim() || null;
    if (data.city !== undefined) clean.city = data.city?.toString().trim() || null;
    if (data.state !== undefined) {
      const state = data.state?.toString().trim().toUpperCase() || null;
      if (state && !isValidBrState(state)) throw httpError("UF inválida.", 400);
      clean.state = state;
    }
    if (data.specialties !== undefined) {
      const invalid = data.specialties.filter((s) => !isValidSpecialty(s));
      if (invalid.length > 0) throw httpError(`Especialidade inválida: ${invalid.join(", ")}.`, 400);
      clean.specialties = data.specialties as Specialty[];
    }
    return connectionsRepository.updateProfile(userId, clean);
  },

  /**
   * Fase 76: aluno inicia contato mandando uma MENSAGEM (em vez de um clique
   * cego em "Solicitar vínculo") — a mensagem é o que cria a solicitação,
   * deixando-a PENDENTE, e os dois lados podem continuar a conversa
   * (`sendMessage`) enquanto ela não for recusada. Nunca cria o vínculo
   * direto — isso só acontece quando o profissional aceita.
   */
  async createRequest(alunoId: string, professionalId: string, message: string) {
    if (!professionalId) throw httpError("professionalId é obrigatório.", 400);
    if (professionalId === alunoId) throw httpError("Solicitação inválida.", 400);
    const trimmedMessage = message?.toString().trim();
    if (!trimmedMessage) throw httpError("Escreva uma mensagem para enviar.", 400);

    const professional = await connectionsRepository.findUserById(professionalId);
    if (
      !professional ||
      (professional.role !== "PERSONAL" && professional.role !== "NUTRICIONISTA")
    ) {
      throw httpError("Profissional não encontrado.", 404);
    }
    if (!professional.availableForNewStudents) {
      throw httpError("Este profissional não está aceitando novos alunos.", 409);
    }

    const existing = await connectionsRepository.findRequestByPair(alunoId, professionalId);
    if (existing?.status === "PENDENTE") {
      throw httpError("Você já tem uma conversa pendente com este profissional.", 409);
    }
    if (existing?.status === "ACEITA") {
      throw httpError("Você já está vinculado a este profissional.", 409);
    }

    const request = await connectionsRepository.upsertPendingRequest(
      alunoId,
      professionalId,
      professional.role as ProfessionalRole
    );
    await connectionsRepository.createMessage(request.id, alunoId, trimmedMessage);

    await notificationsService.notify(
      professionalId,
      "connection_request",
      "Você recebeu uma nova mensagem de um aluno."
    );

    return request;
  },

  /**
   * Fase 76: mensagem de acompanhamento numa conversa já existente — pode
   * ser enviada pelo aluno OU pelo profissional (os dois lados da mesma
   * ConnectionRequest), enquanto ela não estiver RECUSADA.
   */
  async sendMessage(requestId: string, senderId: string, body: string) {
    const trimmed = body?.toString().trim();
    if (!trimmed) throw httpError("Escreva uma mensagem para enviar.", 400);

    const request = await connectionsRepository.findRequestById(requestId);
    if (!request) throw httpError("Conversa não encontrada.", 404);
    if (request.alunoId !== senderId && request.professionalId !== senderId) {
      throw httpError("Você não tem permissão sobre esta conversa.", 403);
    }
    if (request.status === "RECUSADA") {
      throw httpError("Esta conversa foi encerrada.", 409);
    }

    const created = await connectionsRepository.createMessage(requestId, senderId, trimmed);
    const recipientId = request.alunoId === senderId ? request.professionalId : request.alunoId;
    await notificationsService.notify(recipientId, "new_message", "Você recebeu uma nova mensagem.");
    return created;
  },

  async listMessages(requestId: string, userId: string) {
    const request = await connectionsRepository.findRequestById(requestId);
    if (!request) throw httpError("Conversa não encontrada.", 404);
    if (request.alunoId !== userId && request.professionalId !== userId) {
      throw httpError("Você não tem permissão sobre esta conversa.", 403);
    }
    return connectionsRepository.listMessages(requestId);
  },

  /** Profissional vê as solicitações recebidas; aluno vê o status das suas. */
  async listRequests(userId: string, role: string) {
    const isProfessional = role === "PERSONAL" || role === "NUTRICIONISTA";
    const requests = isProfessional
      ? await connectionsRepository.findRequestsForProfessional(userId)
      : await connectionsRepository.findRequestsForAluno(userId);

    // Enriquecer com o e-mail do "outro lado" (aluno p/ o profissional, e
    // profissional p/ o aluno) para a UI exibir quem é.
    const counterpartIds = [
      ...new Set(requests.map((r) => (isProfessional ? r.alunoId : r.professionalId))),
    ];
    const users = await connectionsRepository.usersByIds(counterpartIds);
    const byId = new Map(users.map((u) => [u.id, u]));

    return requests.map((r) => {
      const counterpartId = isProfessional ? r.alunoId : r.professionalId;
      const counterpart = byId.get(counterpartId);
      return {
        id: r.id,
        status: r.status,
        professionalType: r.professionalType,
        createdAt: r.createdAt,
        counterpart: counterpart
          ? {
              id: counterpart.id,
              email: counterpart.email,
              city: counterpart.city,
              state: counterpart.state,
              bio: counterpart.bio,
              avatarUrl: counterpart.avatarUrl,
            }
          : { id: counterpartId, email: "(usuário removido)", city: null, state: null, bio: null, avatarUrl: null },
      };
    });
  },

  /**
   * Profissional aceita: cria o ClientRelation REAL (reusa a regra de limite
   * Freemium do relations.service). Se o limite estiver cheio, o
   * createRelation lança 403 — propagamos e a solicitação PERMANECE PENDENTE
   * (o profissional precisa liberar espaço/fazer upgrade e aceitar de novo).
   * Só marcamos ACEITA quando o vínculo é criado de fato.
   */
  async acceptRequest(requestId: string, professionalId: string) {
    const request = await connectionsRepository.findRequestById(requestId);
    if (!request) throw httpError("Solicitação não encontrada.", 404);
    if (request.professionalId !== professionalId) {
      throw httpError("Você não tem permissão sobre esta solicitação.", 403);
    }
    if (request.status !== "PENDENTE") {
      throw httpError("Esta solicitação já foi respondida.", 409);
    }

    // Pode lançar 403 (limite atingido) ou 404 (aluno inválido) — nesses
    // casos a solicitação segue PENDENTE, de propósito (o profissional
    // resolve a causa e tenta aceitar de novo).
    try {
      await relationsService.createRelation(
        professionalId,
        request.alunoId,
        request.professionalType as ProfessionalRole
      );
    } catch (err) {
      // C1 (auditoria 2026-07-31): se o vínculo JÁ EXISTE (criado por outro
      // caminho — vínculo direto por e-mail, convite por link — enquanto
      // esta solicitação ainda estava pendente), trata como sucesso: aceitar
      // aqui só formaliza o que já é verdade. Sem isso, a solicitação ficava
      // PRESA em PENDENTE pra sempre — aceitar sempre dava 409 de novo, e
      // recusar fecharia a conversa de um aluno que já é cliente.
      const isDuplicate =
        (err as any)?.statusCode === 409 && /vínculo já existe/i.test((err as Error).message ?? "");
      if (!isDuplicate) throw err;
    }

    const updated = await connectionsRepository.setRequestStatus(requestId, "ACEITA");
    await notificationsService.notify(
      request.alunoId,
      "connection_accepted",
      "Sua solicitação de vínculo foi aceita! Você já pode ver seus treinos."
    );
    return updated;
  },

  async rejectRequest(requestId: string, professionalId: string) {
    const request = await connectionsRepository.findRequestById(requestId);
    if (!request) throw httpError("Solicitação não encontrada.", 404);
    if (request.professionalId !== professionalId) {
      throw httpError("Você não tem permissão sobre esta solicitação.", 403);
    }
    if (request.status !== "PENDENTE") {
      throw httpError("Esta solicitação já foi respondida.", 409);
    }
    const updated = await connectionsRepository.setRequestStatus(requestId, "RECUSADA");
    await notificationsService.notify(
      request.alunoId,
      "connection_rejected",
      "Sua solicitação de vínculo foi recusada."
    );
    return updated;
  },
};
