import { Role } from "@prisma/client";
import { contactRepository } from "../repository/contact.repository";
import { sendMail } from "../../lib/mailer";

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export const contactService = {
  /**
   * Fase 78 — "Fale Conosco". A mensagem é SEMPRE gravada primeiro (trilha
   * durável) — o envio de e-mail é best-effort por cima disso, nunca o
   * contrário. Se o e-mail falhar (ou não estiver configurado), a mensagem
   * não se perde, só fica sem `emailSentAt`.
   */
  async send(userId: string, role: Role, title: string, message: string) {
    const trimmedTitle = title?.toString().trim();
    const trimmedMessage = message?.toString().trim();

    if (!trimmedTitle) {
      throw httpError("Título é obrigatório.", 400);
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      throw httpError(`Título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres.`, 400);
    }
    if (!trimmedMessage) {
      throw httpError("Mensagem é obrigatória.", 400);
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw httpError(`Mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`, 400);
    }

    const created = await contactRepository.create({
      userId,
      role,
      title: trimmedTitle,
      message: trimmedMessage,
    });

    const to = process.env.CONTACT_EMAIL_TO;
    let emailSent = false;
    if (to) {
      try {
        emailSent = await sendMail({
          to,
          subject: `[ThunderaFit — Fale Conosco] ${trimmedTitle}`,
          text: `De: ${userId} (${role})\n\n${trimmedMessage}`,
        });
      } catch (err) {
        // Best-effort: erro de envio nunca derruba a requisição — a
        // mensagem já está gravada, o founder ainda consegue ver depois.
        console.error("Falha ao enviar e-mail de Fale Conosco:", err);
      }
    }

    if (emailSent) {
      await contactRepository.markEmailSent(created.id);
    }

    return { id: created.id, emailSent };
  },
};
