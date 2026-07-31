import crypto from "crypto";
import prisma from "../../lib/prisma";
import { clientInvitesRepository } from "../repository/client-invites.repository";
import { relationsService } from "./relations.service";

// Fase 104 — mesmo padrão de token de auth.service.ts (emailVerification/
// passwordReset): 256 bits de entropia, só o HASH sha256 é gravado, o token
// cru só existe na hora de montar o link (nunca recuperável depois).
const INVITE_TOKEN_BYTES = 32;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function generateRawToken(): string {
  return crypto.randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export const clientInvitesService = {
  /**
   * Cria um convite — só um apelido (pro Personal reconhecer na própria
   * lista, NUNCA mostrado pra quem abre o link) é necessário, sem precisar
   * saber o e-mail do aluno de antemão. Checa o limite de alunos NA
   * CRIAÇÃO (falha rápido, feedback imediato) — `consumeInvite` abaixo
   * checa de novo na hora de consumir, como defesa (o limite pode mudar
   * nesse meio-tempo).
   */
  async createInvite(
    personalId: string,
    professionalType: "PERSONAL" | "NUTRICIONISTA",
    label: string
  ) {
    if (!label?.trim()) throw httpError("Dê um apelido pro convite (só pra você reconhecer na lista).", 400);
    await relationsService.assertUnderAlunoLimit(personalId);

    const rawToken = generateRawToken();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
    const invite = await clientInvitesRepository.create(
      personalId,
      professionalType,
      label.trim(),
      hashToken(rawToken),
      expiresAt
    );
    return { invite, token: rawToken };
  },

  async listInvites(personalId: string) {
    return clientInvitesRepository.findActiveByPersonal(personalId);
  },

  async revokeInvite(personalId: string, inviteId: string) {
    const invite = await clientInvitesRepository.findById(inviteId);
    if (!invite || invite.personalId !== personalId) {
      throw httpError("Convite não encontrado.", 404);
    }
    if (invite.consumedAt) {
      throw httpError("Este convite já foi usado — não é possível revogar.", 400);
    }
    await clientInvitesRepository.delete(inviteId);
  },

  /**
   * Pública (chamada pela tela de login/cadastro ANTES de existir sessão) —
   * só devolve o que a pessoa convidada precisa ver: o nome de quem
   * convidou. Nunca devolve o `label` (é só pra uso interno do Personal).
   */
  async previewInvite(rawToken: string) {
    const invite = await clientInvitesRepository.findByTokenHash(hashToken(rawToken));
    if (!invite || invite.consumedAt || invite.expiresAt.getTime() < Date.now()) {
      return { valid: false as const };
    }
    const personal = await prisma.user.findUnique({ where: { id: invite.personalId } });
    return {
      valid: true as const,
      professionalName: personal?.name?.trim() || personal?.email || "seu profissional",
      professionalType: invite.professionalType,
    };
  },

  /**
   * Consome o convite — NUNCA lança (usada tanto no register/login/SSO —
   * onde uma falha aqui não pode derrubar o cadastro que já aconteceu antes
   * desta chamada — quanto no endpoint dedicado abaixo, chamado por quem já
   * estava logado quando abriu o link). Devolve o resultado (em vez de só
   * engolir silenciosamente) porque o endpoint dedicado PRECISA saber se
   * funcionou pra mostrar sucesso/erro de verdade pra quem clicou "Vincular
   * agora" — só o register/login/SSO ignoram o retorno de propósito.
   */
  async consumeInvite(
    rawToken: string,
    alunoId: string
  ): Promise<{ consumed: boolean; reason?: string }> {
    try {
      const invite = await clientInvitesRepository.findByTokenHash(hashToken(rawToken));
      if (!invite) return { consumed: false, reason: "Convite inválido." };
      if (invite.expiresAt.getTime() < Date.now()) {
        return { consumed: false, reason: "Este convite expirou." };
      }

      const claimed = await clientInvitesRepository.tryConsume(invite.id, alunoId);
      if (!claimed) {
        return { consumed: false, reason: "Este convite já foi usado." };
      }

      try {
        await relationsService.createRelation(invite.personalId, alunoId, invite.professionalType);
      } catch (err) {
        // F2 (auditoria 2026-07-31): sem isso, uma falha AQUI (limite de
        // alunos mudou nesse meio-tempo, duplicata) deixava o convite
        // permanentemente queimado — marcado consumido, mas sem nenhum
        // vínculo criado. Desfaz o consumo pra o Personal poder revogar (ou
        // o aluno tentar de novo com o mesmo link) em vez de ficar com um
        // link morto e um cadastro órfão.
        await clientInvitesRepository.unconsume(invite.id, alunoId);
        throw err;
      }
      return { consumed: true };
    } catch (err) {
      // Fase 20 já rejeita duplicata (409) e limite (403) aqui dentro — a
      // mensagem real (`err.message`) é mais útil pra quem clicou o botão
      // do que um genérico "algo deu errado".
      const message = err instanceof Error ? err.message : "Não foi possível concluir o vínculo.";
      console.error("Falha ao consumir convite de vínculo:", err);
      return { consumed: false, reason: message };
    }
  },
};
