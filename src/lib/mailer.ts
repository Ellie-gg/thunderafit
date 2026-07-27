import nodemailer from "nodemailer";

/**
 * Fase 78 — envio de e-mail via Gmail SMTP (nodemailer), sem serviço
 * terceiro nenhum (SendGrid/Mailgun/etc) e sem custo — só precisa de uma
 * conta Gmail com uma "senha de app" (App Password, exige 2FA ativado),
 * gerada em myaccount.google.com/apppasswords. Reaproveita a MESMA conta
 * tanto pra enviar quanto (por padrão) como destinatária — ver
 * CONTACT_EMAIL_TO em contact.service.ts.
 *
 * Sem `CONTACT_GMAIL_USER`/`CONTACT_GMAIL_APP_PASSWORD` configurados (ex:
 * ambiente local sem esses segredos ainda), `sendMail` retorna `false` sem
 * lançar erro — quem chama decide o que fazer (aqui: grava a mensagem no
 * banco de qualquer forma, e só marca `emailSentAt` se o envio funcionar).
 */
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.CONTACT_GMAIL_USER;
  const pass = process.env.CONTACT_GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendMail(options: { to: string; subject: string; text: string }): Promise<boolean> {
  const client = getTransporter();
  if (!client) return false;

  const from = process.env.CONTACT_GMAIL_USER!;
  await client.sendMail({ from, to: options.to, subject: options.subject, text: options.text });
  return true;
}
