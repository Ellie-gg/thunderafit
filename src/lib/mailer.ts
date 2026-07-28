import { Resend } from "resend";

/**
 * Fase 83 — troca do Gmail SMTP (Fase 78) pelo Resend, agora que o domínio
 * thunderafit.com.br está verificado lá (SPF/DKIM/DMARC via DNS no
 * registro.br). Vantagens sobre o Gmail pessoal: remetente profissional
 * (`no-reply@thunderafit.com.br` em vez do e-mail pessoal do fundador),
 * melhor entregabilidade (autenticação de domínio própria, não uma conta
 * Gmail comum), e volume atual cabe folgado no tier grátis (3.000
 * e-mails/mês).
 *
 * Sem `RESEND_API_KEY` configurada (ex: ambiente local sem o segredo
 * ainda), `sendMail` retorna `false` sem lançar erro — mesmo contrato de
 * antes, quem chama decide o que fazer (contact.service.ts grava a
 * mensagem no banco de qualquer forma, só marca `emailSentAt` se enviar).
 */
const MAIL_FROM = "ThunderaFit <no-reply@thunderafit.com.br>";

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export async function sendMail(options: { to: string; subject: string; text: string }): Promise<boolean> {
  const resend = getClient();
  if (!resend) return false;

  const { error } = await resend.emails.send({
    from: MAIL_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
  });

  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
  return true;
}
