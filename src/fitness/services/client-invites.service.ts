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
   * Consome o convite — SEMPRE melhor esforço (nunca derruba o cadastro/
   * login/SSO de quem está se vinculando, mesmo se o convite já expirou,
   * já foi usado, ou o limite de alunos do Personal mudou nesse meio-tempo:
   * a conta da pessoa já existe/logou antes desta chamada rodar, então uma
   * falha aqui só significa "o vínculo automático não aconteceu", nunca
   * "o cadastro falhou").
   */
  async consumeInvite(rawToken: string, alunoId: string): Promise<void> {
    try {
      const invite = await clientInvitesRepository.findByTokenHash(hashToken(rawToken));
      if (!invite || invite.expiresAt.getTime() < Date.now()) return;

      const claimed = await clientInvitesRepository.tryConsume(invite.id, alunoId);
      if (!claimed) return; // corrida perdida (já consumido por outra chamada) ou concorrência

      await relationsService.createRelation(invite.personalId, alunoId, invite.professionalType);
    } catch (err) {
      console.error("Falha ao consumir convite de vínculo (não afeta o cadastro/login):", err);
    }
  },
};
