import { connectionsRepository } from "../repository/connections.repository";
import { relationsService } from "../../fitness/services/relations.service";
import { notificationsService } from "../../notifications/services/notifications.service";

type ProfessionalRole = "PERSONAL" | "NUTRICIONISTA";

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export const connectionsService = {
  async searchProfessionals(location: string | undefined, role: ProfessionalRole) {
    return connectionsRepository.searchProfessionals({ role, location: location?.trim() || undefined });
  },

  async getMyProfile(userId: string) {
    const profile = await connectionsRepository.getProfile(userId);
    if (!profile) throw httpError("Usuário não encontrado.", 404);
    return profile;
  },

  async updateMyProfile(
    userId: string,
    role: string,
    data: { availableForNewStudents?: boolean; location?: string | null; bio?: string | null }
  ) {
    if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
      throw httpError("Apenas profissionais têm perfil público.", 403);
    }
    const clean: { availableForNewStudents?: boolean; location?: string | null; bio?: string | null } = {};
    if (typeof data.availableForNewStudents === "boolean") {
      // Gate de degrau: Free não pode ATIVAR disponibilidade no diretório
      // (Base+ ganhou esse acesso nesta fase). Desligar continua sempre
      // permitido em qualquer degrau.
      if (data.availableForNewStudents) {
        const user = await connectionsRepository.findUserById(userId);
        if (user?.planoAssinatura === "FREE") {
          throw httpError(
            "Disponibilidade no diretório é um recurso dos planos Base e Plus. Faça upgrade para ativar.",
            403
          );
        }
      }
      clean.availableForNewStudents = data.availableForNewStudents;
    }
    if (data.location !== undefined) clean.location = data.location?.toString().trim() || null;
    if (data.bio !== undefined) clean.bio = data.bio?.toString().trim() || null;
    return connectionsRepository.updateProfile(userId, clean);
  },

  /**
   * Aluno solicita vínculo a um profissional disponível. Nunca cria o vínculo
   * direto — deixa a solicitação PENDENTE e notifica o profissional.
   */
  async createRequest(alunoId: string, professionalId: string) {
    if (!professionalId) throw httpError("professionalId é obrigatório.", 400);
    if (professionalId === alunoId) throw httpError("Solicitação inválida.", 400);

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
      throw httpError("Você já tem uma solicitação pendente com este profissional.", 409);
    }
    if (existing?.status === "ACEITA") {
      throw httpError("Você já está vinculado a este profissional.", 409);
    }

    const request = await connectionsRepository.upsertPendingRequest(
      alunoId,
      professionalId,
      professional.role as ProfessionalRole
    );

    await notificationsService.notify(
      professionalId,
      "connection_request",
      "Você recebeu uma nova solicitação de vínculo de um aluno."
    );

    return request;
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
          ? { id: counterpart.id, email: counterpart.email, location: counterpart.location, bio: counterpart.bio }
          : { id: counterpartId, email: "(usuário removido)", location: null, bio: null },
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

    // Pode lançar 403 (limite atingido), 404 (aluno inválido) ou 409 (já
    // vinculado) — nesses casos a solicitação segue PENDENTE.
    await relationsService.createRelation(
      professionalId,
      request.alunoId,
      request.professionalType as ProfessionalRole
    );

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
